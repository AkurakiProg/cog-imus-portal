const test = require('node:test');
const assert = require('node:assert');
const { normalizePhilippineNumber, sendSms, sendViaSemaphore } = require('../utils/smsService');

test('Semaphore Gateway Unit Tests', async (t) => {
    const originalEnv = { ...process.env };

    t.afterEach(() => {
        process.env = { ...originalEnv };
    });

    await t.test('1. Number normalization handles Philippine numbers properly', () => {
        assert.strictEqual(normalizePhilippineNumber('09763256103').local, '09763256103');
        assert.strictEqual(normalizePhilippineNumber('+639763256103').local, '09763256103');
        assert.strictEqual(normalizePhilippineNumber('639763256103').local, '09763256103');
        assert.strictEqual(normalizePhilippineNumber('9763256103').local, '09763256103');
        assert.strictEqual(normalizePhilippineNumber('09763256103').international, '+639763256103');
    });

    await t.test('2. Semaphore API key sanitization strips accidental wrapping quotes', async () => {
        process.env.SEMAPHORE_API_KEY = '"4a703a451d71feec522d29f49a01af94"';
        process.env.SEMAPHORE_SENDER_NAME = '';
        
        // Mock global fetch to intercept request payload
        const originalFetch = global.fetch;
        let interceptedPayload = null;

        global.fetch = async (url, options) => {
            interceptedPayload = JSON.parse(options.body);
            return {
                ok: true,
                json: async () => [{ message_id: 12345, status: 'Queued' }]
            };
        };

        try {
            const res = await sendViaSemaphore('09763256103', 'Unit test');
            assert.strictEqual(res.success, true);
            assert.strictEqual(interceptedPayload.apikey, '4a703a451d71feec522d29f49a01af94');
            assert.strictEqual(interceptedPayload.sendername, undefined, 'sendername omitted when empty');
        } finally {
            global.fetch = originalFetch;
        }
    });

    await t.test('3. Self-Healing: When sender name is unapproved, automatically retries without sender name', async () => {
        process.env.SEMAPHORE_API_KEY = 'valid_api_key';
        process.env.SEMAPHORE_SENDER_NAME = 'UNAPPROVED_NAME';

        const originalFetch = global.fetch;
        let callCount = 0;
        const payloads = [];

        global.fetch = async (url, options) => {
            callCount++;
            const payload = JSON.parse(options.body);
            payloads.push(payload);

            if (callCount === 1) {
                // First call with UNAPPROVED_NAME fails with Semaphore sendername error
                return {
                    ok: true,
                    json: async () => ({ sendername: ['The selected sendername is invalid.'] })
                };
            }

            // Second call (auto-retry without sendername) succeeds!
            return {
                ok: true,
                json: async () => [{ message_id: 99999, status: 'Queued' }]
            };
        };

        try {
            const res = await sendViaSemaphore('09763256103', 'Test healing');
            assert.strictEqual(callCount, 2, 'Retried exactly once');
            assert.strictEqual(payloads[0].sendername, 'UNAPPROVED_NAME');
            assert.strictEqual(payloads[1].sendername, undefined, 'Sender name removed on retry');
            assert.strictEqual(res.success, true, 'Delivery succeeded via auto-retry');
        } finally {
            global.fetch = originalFetch;
        }
    });

    await t.test('4. Configured Semaphore failure does NOT fall back to simulation mode', async () => {
        process.env.SEMAPHORE_API_KEY = 'mock_key';
        delete process.env.TEXTBEE_API_KEY;
        delete process.env.TEXTBELT_API_KEY;
        delete process.env.TWILIO_ACCOUNT_SID;

        const originalFetch = global.fetch;
        global.fetch = async () => ({
            ok: false,
            json: async () => ({ error: 'Insufficient balance' })
        });

        try {
            const res = await sendSms('09763256103', 'Balance check');
            assert.strictEqual(res.status, 'Failed');
            assert.ok(res.gateway_response.includes('Semaphore Gateway Error'), 'Error surfaced to user, not masked');
            assert.notStrictEqual(res.status, 'Simulated', 'Must not claim simulation mode when key is configured');
        } finally {
            global.fetch = originalFetch;
        }
    });
});
