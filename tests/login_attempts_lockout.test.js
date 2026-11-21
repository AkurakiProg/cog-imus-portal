const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bcrypt = require('bcryptjs');

const app = require('../server');
const { pool } = require('../config/database');
const loginAttemptLimiter = require('../utils/loginAttemptLimiter');

let server;
let baseUrl;
const createdUserIds = [];

async function createTempUser(prefix) {
    const uniq = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const username = `${prefix}_${uniq}`;
    const email = `${username}@cogimus.test`;
    const password = 'ValidPortalPassword123!';
    const passwordHash = await bcrypt.hash(password, 10);

    const [res] = await pool.execute(
        `INSERT INTO users (role_id, username, email, password_hash, first_name, last_name, full_name, is_active, is_verified, mfa_enabled)
         VALUES (3, ?, ?, ?, 'Lockout', 'Tester', ?, 1, 1, 0)`,
        [username, email, passwordHash, `Lockout Tester ${uniq}`]
    );
    createdUserIds.push(res.insertId);
    return { userId: res.insertId, username, email, password };
}

test.before(async () => {
    loginAttemptLimiter._resetAll();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
});

test.after(async () => {
    loginAttemptLimiter._setNowProvider(null);
    loginAttemptLimiter._resetAll();
    try {
        for (const uid of createdUserIds) {
            await pool.execute('DELETE FROM audit_trail WHERE user_id = ?', [uid]).catch(() => {});
            await pool.execute('DELETE FROM users WHERE user_id = ?', [uid]).catch(() => {});
        }
    } finally {
        await new Promise((resolve) => server.close(resolve));
        await pool.end();
    }
});

test('Unit: loginAttemptLimiter counts 3 attempts, locks for 3 minutes, and resets after expiry', () => {
    loginAttemptLimiter._resetAll();
    let now = 1_700_000_000_000;
    const keys = ['user:9999', 'ctx:browser_unit_1'];

    assert.equal(loginAttemptLimiter.MAX_LOGIN_ATTEMPTS, 3);
    assert.equal(loginAttemptLimiter.LOCKOUT_DURATION_MS, 180_000);

    let s = loginAttemptLimiter.recordFailure(keys, now);
    assert.equal(s.locked, false);
    assert.equal(s.attemptsUsed, 1);
    assert.equal(s.attemptsRemaining, 2);

    s = loginAttemptLimiter.recordFailure(keys, now + 1000);
    assert.equal(s.locked, false);
    assert.equal(s.attemptsUsed, 2);
    assert.equal(s.attemptsRemaining, 1);

    // 3rd failure triggers the 3-minute lockout
    const lockedAt = now + 2000;
    s = loginAttemptLimiter.recordFailure(keys, lockedAt);
    assert.equal(s.locked, true);
    assert.equal(s.justLocked, true);
    assert.equal(s.attemptsRemaining, 0);
    assert.equal(s.retryAfterSeconds, 180);
    assert.equal(s.lockedUntil, lockedAt + 180_000);

    // Probing during lockout stays locked without extending lockedUntil
    const duringLock = loginAttemptLimiter.recordFailure(keys, lockedAt + 60_000);
    assert.equal(duringLock.locked, true);
    assert.equal(duringLock.justLocked, false);
    assert.equal(duringLock.lockedUntil, lockedAt + 180_000);
    assert.equal(duringLock.retryAfterSeconds, 120);

    // 1 second before expiry: still locked
    const justBefore = loginAttemptLimiter.checkLock(keys, lockedAt + 179_000);
    assert.equal(justBefore.locked, true);
    assert.equal(justBefore.retryAfterSeconds, 1);

    // Exactly 3 minutes later: unlocked with fresh 3 attempts
    const afterExpiry = loginAttemptLimiter.checkLock(keys, lockedAt + 180_000);
    assert.equal(afterExpiry.locked, false);
    assert.equal(afterExpiry.attemptsUsed, 0);
    assert.equal(afterExpiry.attemptsRemaining, 3);

    // Failing again after expiry starts cleanly at attempt 1 (2 remaining)
    const freshFail = loginAttemptLimiter.recordFailure(keys, lockedAt + 180_000);
    assert.equal(freshFail.locked, false);
    assert.equal(freshFail.attemptsUsed, 1);
    assert.equal(freshFail.attemptsRemaining, 2);

    // Successful auth clears failure count
    loginAttemptLimiter.clearAttempts(keys);
    const cleared = loginAttemptLimiter.checkLock(keys, lockedAt + 181_000);
    assert.equal(cleared.attemptsUsed, 0);
    assert.equal(cleared.attemptsRemaining, 3);
});

test('API Integration: POST /api/auth/login enforces 3 attempts, 3-minute block (even with valid password), and unlocks when timer ends', async () => {
    loginAttemptLimiter._resetAll();
    let fakeNow = 1_800_000_000_000;
    loginAttemptLimiter._setNowProvider(() => fakeNow);

    const user = await createTempUser('lockout_api');
    const browserCtx = `testctx_${Date.now()}`;

    const postLogin = async (password) => {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Browser-Context': browserCtx
            },
            body: JSON.stringify({
                identifier: user.username,
                password,
                browserContextId: browserCtx
            })
        });
        const json = await res.json();
        return { status: res.status, headers: res.headers, json };
    };

    // Attempt 1 (wrong)
    const r1 = await postLogin('WrongPassword1!');
    assert.equal(r1.status, 401);
    assert.equal(r1.json.data.locked, false);
    assert.equal(r1.json.data.attemptsRemaining, 2);
    assert.match(r1.json.message, /2 login attempts remaining/i);

    // Attempt 2 (wrong)
    fakeNow += 5000;
    const r2 = await postLogin('WrongPassword2!');
    assert.equal(r2.status, 401);
    assert.equal(r2.json.data.locked, false);
    assert.equal(r2.json.data.attemptsRemaining, 1);
    assert.match(r2.json.message, /1 login attempt remaining/i);

    // Attempt 3 (wrong) -> Lockout engages for 3 minutes (180 seconds)
    fakeNow += 5000;
    const lockStart = fakeNow;
    const r3 = await postLogin('WrongPassword3!');
    assert.equal(r3.status, 429);
    assert.equal(r3.headers.get('retry-after'), '180');
    assert.equal(r3.json.data.locked, true);
    assert.equal(r3.json.data.attemptsRemaining, 0);
    assert.equal(r3.json.data.retryAfterSeconds, 180);

    // Attempt 4 at +60s with VALID password -> Still blocked!
    fakeNow = lockStart + 60_000;
    const rBlockedValid = await postLogin(user.password);
    assert.equal(rBlockedValid.status, 429);
    assert.equal(rBlockedValid.headers.get('retry-after'), '120');
    assert.equal(rBlockedValid.json.data.locked, true);
    assert.equal(rBlockedValid.json.data.retryAfterSeconds, 120);

    // Attempt 5 at +179s with VALID password -> Still blocked with 1s remaining!
    fakeNow = lockStart + 179_000;
    const rAlmost = await postLogin(user.password);
    assert.equal(rAlmost.status, 429);
    assert.equal(rAlmost.json.data.retryAfterSeconds, 1);

    // Attempt 6 at +180s (3 minutes elapsed) with VALID password -> Succeeds!
    fakeNow = lockStart + 180_000;
    const rSuccess = await postLogin(user.password);
    assert.equal(rSuccess.status, 200);
    assert.equal(rSuccess.json.success, true);
    assert.ok(rSuccess.json.data.token);
});

test('API Integration: Successful login before 3rd failure resets failed attempt counter', async () => {
    loginAttemptLimiter._resetAll();
    let fakeNow = 1_850_000_000_000;
    loginAttemptLimiter._setNowProvider(() => fakeNow);

    const user = await createTempUser('lockout_reset');
    const browserCtx = `resetctx_${Date.now()}`;

    const postLogin = async (password) => {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Browser-Context': browserCtx },
            body: JSON.stringify({ identifier: user.username, password, browserContextId: browserCtx })
        });
        return { status: res.status, json: await res.json() };
    };

    const f1 = await postLogin('Bad1!');
    assert.equal(f1.status, 401);
    assert.equal(f1.json.data.attemptsRemaining, 2);

    const f2 = await postLogin('Bad2!');
    assert.equal(f2.status, 401);
    assert.equal(f2.json.data.attemptsRemaining, 1);

    // Correct password on 3rd try succeeds and resets attempts
    const ok = await postLogin(user.password);
    assert.equal(ok.status, 200);
    assert.equal(ok.json.success, true);

    // Subsequent wrong password gets fresh 2 attempts remaining
    const fAfter = await postLogin('Bad3!');
    assert.equal(fAfter.status, 401);
    assert.equal(fAfter.json.data.attemptsRemaining, 2);
});

test('Frontend: login.html, api.js, and auth.js wire 3-minute countdown lock and auto-unlock cleanly', async () => {
    const loginHtml = fs.readFileSync(path.join(__dirname, '../public/views/login.html'), 'utf8');
    assert.match(loginHtml, /id="loginLockoutBanner"/);
    assert.match(loginHtml, /id="loginLockoutTimer"/);
    assert.match(loginHtml, /\/js\/api\.js\?v=20261121_v5/);
    assert.match(loginHtml, /\/js\/auth\.js\?v=20261121_v5/);

    const authCode = fs.readFileSync(path.join(__dirname, '../public/js/auth.js'), 'utf8');

    const storageMap = new Map();
    const localStorageMock = {
        getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
        setItem: (k, v) => storageMap.set(k, String(v)),
        removeItem: (k) => storageMap.delete(k)
    };
    const sessionStorageMock = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
    };

    const makeEl = (id, initialValue = '') => {
        const listeners = {};
        return {
            id,
            value: initialValue,
            disabled: false,
            style: { display: 'none' },
            className: '',
            innerHTML: '',
            textContent: '',
            childrenById: {},
            setAttribute: () => {},
            getAttribute: () => '',
            focus: () => {},
            classList: { contains: () => false, add: () => {}, remove: () => {} },
            addEventListener: (ev, fn) => {
                listeners[ev] = listeners[ev] || [];
                listeners[ev].push(fn);
            },
            trigger: async (ev, evtObj) => {
                for (const fn of (listeners[ev] || [])) {
                    await fn(evtObj);
                }
            }
        };
    };

    const elements = {
        loginForm: makeEl('loginForm'),
        identifier: makeEl('identifier', 'testuser'),
        password: makeEl('password', 'WrongPass!'),
        btnLogin: makeEl('btnLogin'),
        alertMessage: makeEl('alertMessage'),
        loginLockoutBanner: makeEl('loginLockoutBanner'),
        loginLockoutTimer: makeEl('loginLockoutTimer'),
        btnLoginCountdown: makeEl('btnLoginCountdown')
    };

    let fakeClientNow = 1_900_000_000_000;
    class FakeDate extends Date {
        static now() {
            return fakeClientNow;
        }
    }

    const intervals = new Map();
    let nextIntervalId = 1;
    const docListeners = {};
    const winListeners = {};

    let callNum = 0;
    const apiMock = {
        public: { getWebsiteContent: async () => ({ success: false }) },
        auth: {
            login: async () => {
                callNum++;
                if (callNum === 1) {
                    const err = new Error('Invalid credentials. You have 2 login attempts remaining before a 3-minute lockout.');
                    err.status = 401;
                    err.data = { locked: false, attemptsRemaining: 2 };
                    throw err;
                }
                if (callNum === 2) {
                    const err = new Error('Invalid credentials. You have 1 login attempt remaining before a 3-minute lockout.');
                    err.status = 401;
                    err.data = { locked: false, attemptsRemaining: 1 };
                    throw err;
                }
                const err = new Error('Too many failed login attempts (3 of 3 used).');
                err.status = 429;
                err.data = { locked: true, attemptsRemaining: 0, retryAfterSeconds: 180 };
                throw err;
            }
        }
    };

    const sandbox = {
        Date: FakeDate,
        Math,
        Number,
        String,
        Boolean,
        JSON,
        Array,
        Error,
        console,
        api: apiMock,
        localStorage: localStorageMock,
        sessionStorage: sessionStorageMock,
        URLSearchParams,
        fetch: async () => ({ ok: false, json: async () => ({ success: false }) }),
        setInterval: (fn) => {
            const id = nextIntervalId++;
            intervals.set(id, fn);
            return id;
        },
        clearInterval: (id) => intervals.delete(id),
        setTimeout: () => 1,
        clearTimeout: () => {},
        document: {
            readyState: 'complete',
            getElementById: (id) => elements[id] || null,
            addEventListener: (ev, fn) => {
                docListeners[ev] = docListeners[ev] || [];
                docListeners[ev].push(fn);
            }
        },
        window: {
            location: { search: '', href: '', replace: () => {} },
            matchMedia: () => ({ matches: false }),
            addEventListener: (ev, fn) => {
                winListeners[ev] = winListeners[ev] || [];
                winListeners[ev].push(fn);
            },
            removeEventListener: () => {}
        }
    };
    sandbox.globalThis = sandbox;

    vm.runInNewContext(authCode, sandbox);
    for (const fn of (docListeners.DOMContentLoaded || [])) {
        fn();
    }

    const submitEvt = { preventDefault: () => {} };
    const getAlertOutput = () => `${elements.alertMessage.textContent || ''} ${elements.alertMessage.innerHTML || ''}`;

    // Fail 1 & Fail 2 keep Sign In enabled with alert message
    await elements.loginForm.trigger('submit', submitEvt);
    assert.equal(elements.btnLogin.disabled, false);
    assert.match(getAlertOutput(), /2 login attempts remaining/);

    await elements.loginForm.trigger('submit', submitEvt);
    assert.equal(elements.btnLogin.disabled, false);
    assert.match(getAlertOutput(), /1 login attempt remaining/);

    // Fail 3 activates 3-minute cooldown UI
    await elements.loginForm.trigger('submit', submitEvt);
    assert.equal(elements.btnLogin.disabled, true);
    assert.equal(elements.loginLockoutBanner.style.display, 'flex');
    assert.equal(elements.loginLockoutTimer.textContent, '03:00');
    assert.ok(localStorageMock.getItem('cog_login_lockout'));

    // Guard blocks extra submit clicks while locked
    await elements.loginForm.trigger('submit', submitEvt);
    assert.equal(callNum, 3);

    // Advance 90 seconds -> tick shows 01:30
    fakeClientNow += 90_000;
    for (const fn of intervals.values()) fn();
    assert.equal(elements.loginLockoutTimer.textContent, '01:30');
    assert.equal(elements.btnLogin.disabled, true);

    // Advance full 180 seconds -> tick auto-unlocks user
    fakeClientNow += 90_000;
    for (const fn of Array.from(intervals.values())) fn();
    assert.equal(elements.btnLogin.disabled, false);
    assert.equal(elements.loginLockoutBanner.style.display, 'none');
    assert.equal(localStorageMock.getItem('cog_login_lockout'), null);
    assert.match(getAlertOutput(), /3-minute cooldown has ended/i);
});
