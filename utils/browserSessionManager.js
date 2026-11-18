const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const ACCOUNT_SWITCHED_MESSAGE = 'Your session has ended because a different account was logged in using another tab in this browser. Please log in again to continue.';
const EXPLICIT_LOGOUT_MESSAGE = 'Session terminated: You have been logged out. Please log in again to continue.';

// In-memory store keyed by browserCtx -> { userId, sessionToken, updatedAt }
// Intentionally kept in-memory (alongside signed HttpOnly cookies and users.current_session_token)
// so we preserve the exact 33 MySQL table count while enforcing cross-tab browser session isolation.
const browserContextMap = new Map();
const invalidatedBySwitchUsers = new Map();
const explicitlyLoggedOutUsers = new Map();

const MAX_CONTEXT_ENTRIES = 5000;
const MARKER_TTL_MS = 60 * 60 * 1000; // 1 hour

function sanitizeBrowserCtx(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(trimmed)) return null;
    return trimmed;
}

function parseCookies(req) {
    const out = {};
    const header = req && req.headers ? req.headers.cookie : null;
    if (!header || typeof header !== 'string') return out;
    const parts = header.split(';');
    for (const part of parts) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        const key = part.slice(0, idx).trim();
        const val = part.slice(idx + 1).trim();
        if (key) {
            try {
                out[key] = decodeURIComponent(val);
            } catch (e) {
                out[key] = val;
            }
        }
    }
    return out;
}

function getBrowserContextId(req) {
    if (!req) return null;
    const fromHeader = req.header ? req.header('X-Browser-Context') : (req.headers && req.headers['x-browser-context']);
    const cleanHeader = sanitizeBrowserCtx(fromHeader);
    if (cleanHeader) return cleanHeader;

    const fromBody = req.body && req.body.browserContextId;
    const cleanBody = sanitizeBrowserCtx(fromBody);
    if (cleanBody) return cleanBody;

    const cookies = parseCookies(req);
    return sanitizeBrowserCtx(cookies.cog_browser_ctx);
}

function getActiveCookieSession(req) {
    try {
        const cookies = parseCookies(req);
        const token = cookies.cog_active_session;
        if (!token || !process.env.JWT_SECRET) return null;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.type === 'browser_session_cookie' && decoded.userId) {
            return decoded;
        }
    } catch (e) {
        return null;
    }
    return null;
}

function getPreviousTokenPayload(req) {
    try {
        const raw = (req.body && req.body.previousToken) ||
            (req.header && req.header('X-Previous-Token')) ||
            (req.headers && req.headers['x-previous-token']);
        if (!raw || typeof raw !== 'string' || !process.env.JWT_SECRET) return null;
        const decoded = jwt.verify(raw.trim(), process.env.JWT_SECRET);
        if (decoded && (decoded.id || decoded.user_id)) {
            return {
                userId: Number(decoded.id || decoded.user_id),
                sessionToken: decoded.sessionToken || null
            };
        }
    } catch (e) {
        return null;
    }
    return null;
}

function setBrowserSessionCookies(res, browserCtx, userId, sessionToken) {
    if (!res || typeof res.setHeader !== 'function' || !process.env.JWT_SECRET) return;
    try {
        const signed = jwt.sign(
            {
                type: 'browser_session_cookie',
                browserCtx,
                userId: Number(userId),
                sessionToken
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );
        const isProd = process.env.NODE_ENV === 'production';
        const secureAttr = isProd ? '; Secure' : '';
        const newCookies = [
            `cog_browser_ctx=${encodeURIComponent(browserCtx)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secureAttr}`,
            `cog_active_session=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secureAttr}`
        ];
        const existing = res.getHeader('Set-Cookie');
        if (Array.isArray(existing)) {
            res.setHeader('Set-Cookie', [...existing, ...newCookies]);
        } else if (existing) {
            res.setHeader('Set-Cookie', [existing, ...newCookies]);
        } else {
            res.setHeader('Set-Cookie', newCookies);
        }
    } catch (e) {}
}

function clearBrowserSessionCookies(res) {
    if (!res || typeof res.setHeader !== 'function') return;
    try {
        const cleared = 'cog_active_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
        const existing = res.getHeader('Set-Cookie');
        if (Array.isArray(existing)) {
            res.setHeader('Set-Cookie', [...existing, cleared]);
        } else if (existing) {
            res.setHeader('Set-Cookie', [existing, cleared]);
        } else {
            res.setHeader('Set-Cookie', [cleared]);
        }
    } catch (e) {}
}

function pruneMapIfNeeded() {
    if (browserContextMap.size > MAX_CONTEXT_ENTRIES) {
        const firstKey = browserContextMap.keys().next().value;
        if (firstKey) browserContextMap.delete(firstKey);
    }
    const cutoff = Date.now() - MARKER_TTL_MS;
    for (const [k, ts] of invalidatedBySwitchUsers.entries()) {
        if (ts < cutoff) invalidatedBySwitchUsers.delete(k);
    }
    for (const [k, ts] of explicitlyLoggedOutUsers.entries()) {
        if (ts < cutoff) explicitlyLoggedOutUsers.delete(k);
    }
}

/**
 * Determines whether logging in as `user` from this request matches an existing active
 * session for the SAME user in the SAME browser context (so multiple tabs of the same
 * account stay synchronized without logging each other out), and invalidates any
 * DIFFERENT previous account in the same browser context.
 */
async function resolveAndActivateSession({ req, res, user, pool }) {
    const userId = Number(user.user_id);
    const cookieSession = getActiveCookieSession(req);
    const providedCtx = getBrowserContextId(req) || sanitizeBrowserCtx(cookieSession && cookieSession.browserCtx);
    const prevTokenPayload = getPreviousTokenPayload(req);
    const mapEntry = providedCtx ? browserContextMap.get(providedCtx) : null;

    // 1. Collect any prior different user active in this same browser context
    const supersededUserIds = new Set();
    if (mapEntry && Number(mapEntry.userId) !== userId) {
        supersededUserIds.add(Number(mapEntry.userId));
    }
    if (cookieSession && Number(cookieSession.userId) !== userId) {
        supersededUserIds.add(Number(cookieSession.userId));
    }
    if (prevTokenPayload && Number(prevTokenPayload.userId) !== userId) {
        supersededUserIds.add(Number(prevTokenPayload.userId));
    }

    // Invalidate all prior different user sessions in DB and record account-switch marker
    for (const prevUid of supersededUserIds) {
        if (prevUid && !Number.isNaN(prevUid)) {
            await pool.execute('UPDATE users SET current_session_token = NULL WHERE user_id = ?', [prevUid]);
            invalidatedBySwitchUsers.set(prevUid, Date.now());
            explicitlyLoggedOutUsers.delete(prevUid);
        }
    }

    // Also mark other browserContext entries pointing to superseded users? Leave map pointing to new user on providedCtx
    invalidatedBySwitchUsers.delete(userId);
    explicitlyLoggedOutUsers.delete(userId);

    // 2. Check authoritative DB current_session_token: if SAME user is already active in this
    //    same browser context -> preserve their active sessionToken so multiple tabs stay synced
    let sessionToken = null;
    let dbCurrentToken = user.current_session_token || null;
    if (!dbCurrentToken) {
        const [tokRows] = await pool.execute('SELECT current_session_token FROM users WHERE user_id = ? LIMIT 1', [userId]);
        dbCurrentToken = tokRows[0]?.current_session_token || null;
    }

    if (dbCurrentToken) {
        const sameCtxMatch = mapEntry && Number(mapEntry.userId) === userId && mapEntry.sessionToken === dbCurrentToken;
        const sameCookieMatch = cookieSession && Number(cookieSession.userId) === userId && cookieSession.sessionToken === dbCurrentToken;
        const samePrevTokenMatch = prevTokenPayload && Number(prevTokenPayload.userId) === userId && prevTokenPayload.sessionToken === dbCurrentToken;
        if (sameCtxMatch || sameCookieMatch || samePrevTokenMatch) {
            sessionToken = dbCurrentToken;
        }
    }

    if (!sessionToken) {
        sessionToken = uuidv4();
        await pool.execute('UPDATE users SET current_session_token = ? WHERE user_id = ?', [sessionToken, userId]);
    }

    // 3. Bind browser context and issue signed cookies
    const effectiveBrowserCtx = providedCtx || uuidv4();
    pruneMapIfNeeded();
    browserContextMap.set(effectiveBrowserCtx, {
        userId,
        sessionToken,
        updatedAt: Date.now()
    });
    setBrowserSessionCookies(res, effectiveBrowserCtx, userId, sessionToken);

    return {
        sessionToken,
        browserCtx: effectiveBrowserCtx,
        supersededUserIds: Array.from(supersededUserIds)
    };
}

function clearBrowserSession({ req, res, userId }) {
    const uid = userId ? Number(userId) : null;
    const providedCtx = getBrowserContextId(req);
    const cookieSession = getActiveCookieSession(req);
    const ctx = providedCtx || sanitizeBrowserCtx(cookieSession && cookieSession.browserCtx);

    if (ctx) {
        const entry = browserContextMap.get(ctx);
        if (!entry || !uid || Number(entry.userId) === uid) {
            browserContextMap.delete(ctx);
        }
    }
    if (uid) {
        for (const [key, val] of browserContextMap.entries()) {
            if (Number(val.userId) === uid) {
                browserContextMap.delete(key);
            }
        }
        explicitlyLoggedOutUsers.set(uid, Date.now());
        invalidatedBySwitchUsers.delete(uid);
    }
    clearBrowserSessionCookies(res);
}

function getBrowserContextConflict(req, authenticatedUserId) {
    const uid = Number(authenticatedUserId);
    const ctx = getBrowserContextId(req);
    const cookieSession = getActiveCookieSession(req);

    if (ctx) {
        const entry = browserContextMap.get(ctx);
        if (entry && Number(entry.userId) !== uid) {
            return { conflicted: true, activeUserId: Number(entry.userId) };
        }
    }
    if (cookieSession && Number(cookieSession.userId) !== uid) {
        return { conflicted: true, activeUserId: Number(cookieSession.userId) };
    }
    return { conflicted: false };
}

function wasInvalidatedByAccountSwitch(userId) {
    const uid = Number(userId);
    const ts = invalidatedBySwitchUsers.get(uid);
    if (!ts) return false;
    if (Date.now() - ts > MARKER_TTL_MS) {
        invalidatedBySwitchUsers.delete(uid);
        return false;
    }
    return true;
}

function wasExplicitlyLoggedOut(userId) {
    const uid = Number(userId);
    const ts = explicitlyLoggedOutUsers.get(uid);
    if (!ts) return false;
    if (Date.now() - ts > MARKER_TTL_MS) {
        explicitlyLoggedOutUsers.delete(uid);
        return false;
    }
    return true;
}

function clearAccountSwitchMarker(userId) {
    const uid = Number(userId);
    invalidatedBySwitchUsers.delete(uid);
    explicitlyLoggedOutUsers.delete(uid);
}

module.exports = {
    ACCOUNT_SWITCHED_MESSAGE,
    EXPLICIT_LOGOUT_MESSAGE,
    getBrowserContextId,
    resolveAndActivateSession,
    clearBrowserSession,
    getBrowserContextConflict,
    wasInvalidatedByAccountSwitch,
    wasExplicitlyLoggedOut,
    clearAccountSwitchMarker
};
