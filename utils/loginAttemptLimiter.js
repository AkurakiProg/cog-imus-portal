const browserSessionManager = require('./browserSessionManager');

const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const STALE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_STORE_ENTRIES = 10000;

const attemptStore = new Map();
let nowProvider = () => Date.now();

/**
 * Resolve the client IP string from an Express request.
 * @param {object} req
 * @returns {string}
 */
function resolveClientIp(req) {
    if (!req) return 'unknown';
    const rawIp = req.ip
        || (req.socket && req.socket.remoteAddress)
        || (req.connection && req.connection.remoteAddress)
        || 'unknown';
    return String(rawIp).trim() || 'unknown';
}

/**
 * Build deduplicated tracking keys for account-level and browser-context lockout enforcement.
 * Keeping attempt tracking in-memory avoids schema changes (preserving the 33-table invariant).
 * @param {object} params
 * @param {object|null} [params.user]
 * @param {string} [params.identifier]
 * @param {object|null} [params.req]
 * @param {string|null} [params.browserContextId]
 * @returns {string[]}
 */
function buildAttemptKeys({ user = null, identifier = '', req = null, browserContextId = null } = {}) {
    const keys = [];
    const ip = resolveClientIp(req);
    const normalizedIdent = (identifier || '').toString().trim().toLowerCase();

    if (user && user.user_id) {
        keys.push(`user:${user.user_id}`);
    } else if (normalizedIdent) {
        keys.push(`anon:${ip}:${normalizedIdent}`);
    }

    const ctxId = browserContextId || (req ? browserSessionManager.getBrowserContextId(req) : null);
    if (ctxId && typeof ctxId === 'string' && ctxId.trim()) {
        keys.push(`ctx:${ctxId.trim()}`);
    }

    return Array.from(new Set(keys));
}

function getActiveEntry(key, now) {
    const entry = attemptStore.get(key);
    if (!entry) return null;

    if (entry.lockedUntil > 0) {
        if (entry.lockedUntil > now) {
            return entry;
        }
        // Cooldown expired cleanly: remove lock so the user receives a fresh set of 3 attempts.
        attemptStore.delete(key);
        return null;
    }

    if (now - entry.updatedAt > STALE_ATTEMPT_WINDOW_MS) {
        attemptStore.delete(key);
        return null;
    }

    return entry;
}

function pruneExpiredOrOldest(now) {
    for (const [key] of attemptStore.entries()) {
        getActiveEntry(key, now);
    }
    while (attemptStore.size >= MAX_STORE_ENTRIES) {
        const oldestKey = attemptStore.keys().next().value;
        if (oldestKey === undefined) break;
        attemptStore.delete(oldestKey);
    }
}

/**
 * Inspect whether any key in `keys` is currently under a 3-minute login cooldown.
 * @param {string[]} keys
 * @param {number} [now]
 * @returns {object}
 */
function checkLock(keys, now = nowProvider()) {
    const keyList = Array.isArray(keys) ? keys : [keys].filter(Boolean);
    let maxLockedUntil = 0;
    let maxCount = 0;

    for (const key of keyList) {
        const entry = getActiveEntry(key, now);
        if (!entry) continue;
        if (entry.lockedUntil > maxLockedUntil) {
            maxLockedUntil = entry.lockedUntil;
        }
        if (entry.count > maxCount) {
            maxCount = entry.count;
        }
    }

    if (maxLockedUntil > now) {
        const remainingMs = maxLockedUntil - now;
        return {
            locked: true,
            lockedUntil: maxLockedUntil,
            remainingMs,
            retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
            attemptsUsed: MAX_LOGIN_ATTEMPTS,
            maxAttempts: MAX_LOGIN_ATTEMPTS,
            attemptsRemaining: 0
        };
    }

    return {
        locked: false,
        lockedUntil: 0,
        remainingMs: 0,
        retryAfterSeconds: 0,
        attemptsUsed: maxCount,
        maxAttempts: MAX_LOGIN_ATTEMPTS,
        attemptsRemaining: Math.max(0, MAX_LOGIN_ATTEMPTS - maxCount)
    };
}

/**
 * Record a failed login attempt for the provided keys and engage the 3-minute lockout on attempt #3.
 * If already locked, returns the existing cooldown state without extending `lockedUntil`.
 * @param {string[]} keys
 * @param {number} [now]
 * @returns {object}
 */
function recordFailure(keys, now = nowProvider()) {
    const keyList = Array.isArray(keys) ? keys : [keys].filter(Boolean);
    const current = checkLock(keyList, now);
    if (current.locked) {
        return { ...current, justLocked: false };
    }

    if (attemptStore.size >= MAX_STORE_ENTRIES) {
        pruneExpiredOrOldest(now);
    }

    let maxLockedUntil = 0;
    let maxCount = 0;

    for (const key of keyList) {
        const existing = getActiveEntry(key, now);
        const nextCount = (existing ? existing.count : 0) + 1;
        const clampedCount = Math.min(MAX_LOGIN_ATTEMPTS, nextCount);
        const lockedUntil = clampedCount >= MAX_LOGIN_ATTEMPTS ? now + LOCKOUT_DURATION_MS : 0;

        attemptStore.set(key, {
            count: clampedCount,
            lockedUntil,
            updatedAt: now
        });

        if (lockedUntil > maxLockedUntil) maxLockedUntil = lockedUntil;
        if (clampedCount > maxCount) maxCount = clampedCount;
    }

    if (maxLockedUntil > now) {
        const remainingMs = maxLockedUntil - now;
        return {
            locked: true,
            justLocked: true,
            lockedUntil: maxLockedUntil,
            remainingMs,
            retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
            attemptsUsed: MAX_LOGIN_ATTEMPTS,
            maxAttempts: MAX_LOGIN_ATTEMPTS,
            attemptsRemaining: 0
        };
    }

    return {
        locked: false,
        justLocked: false,
        lockedUntil: 0,
        remainingMs: 0,
        retryAfterSeconds: 0,
        attemptsUsed: maxCount,
        maxAttempts: MAX_LOGIN_ATTEMPTS,
        attemptsRemaining: Math.max(0, MAX_LOGIN_ATTEMPTS - maxCount)
    };
}

/**
 * Clear failed login counters once the user authenticates successfully.
 * @param {string[]} keys
 */
function clearAttempts(keys) {
    const keyList = Array.isArray(keys) ? keys : [keys].filter(Boolean);
    for (const key of keyList) {
        attemptStore.delete(key);
    }
}

/**
 * Format remaining cooldown seconds into a readable text snippet (e.g. "2 minutes 45 seconds").
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatRemainingDuration(totalSeconds) {
    const safeSec = Math.max(1, Math.ceil(Number(totalSeconds) || 0));
    const mins = Math.floor(safeSec / 60);
    const secs = safeSec % 60;
    if (mins > 0 && secs > 0) {
        return `${mins} ${mins === 1 ? 'minute' : 'minutes'} and ${secs} ${secs === 1 ? 'second' : 'seconds'}`;
    }
    if (mins > 0) {
        return `${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
    }
    return `${secs} ${secs === 1 ? 'second' : 'seconds'}`;
}

/**
 * Generate a clear user-facing error message for either an active lockout or remaining attempts.
 * @param {object} status
 * @returns {string}
 */
function buildFailureMessage(status) {
    if (status && status.locked) {
        const waitText = formatRemainingDuration(status.retryAfterSeconds);
        return `Too many failed login attempts (${MAX_LOGIN_ATTEMPTS} of ${MAX_LOGIN_ATTEMPTS} used). Please wait ${waitText} before trying to log in again.`;
    }
    const remaining = status ? status.attemptsRemaining : MAX_LOGIN_ATTEMPTS - 1;
    const attemptWord = remaining === 1 ? 'attempt' : 'attempts';
    return `Invalid credentials. You have ${remaining} login ${attemptWord} remaining before a 3-minute lockout.`;
}

function _setNowProvider(fn) {
    nowProvider = typeof fn === 'function' ? fn : () => Date.now();
}

function _resetAll() {
    attemptStore.clear();
}

module.exports = {
    MAX_LOGIN_ATTEMPTS,
    LOCKOUT_DURATION_MS,
    buildAttemptKeys,
    checkLock,
    recordFailure,
    clearAttempts,
    formatRemainingDuration,
    buildFailureMessage,
    _setNowProvider,
    _resetAll
};
