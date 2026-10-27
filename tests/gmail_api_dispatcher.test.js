const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const emailService = require('../utils/emailService');

test('Gmail REST API HTTPS Dispatcher Tests', async (t) => {
    // Preserve original environment
    const originalEnv = {
        GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
        GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
        GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN,
        GMAIL_USER: process.env.GMAIL_USER,
        EMAIL_FROM: process.env.EMAIL_FROM,
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASS: process.env.SMTP_PASS
    };

    t.after(() => {
        // Restore environment variables
        for (const [key, val] of Object.entries(originalEnv)) {
            if (val === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = val;
            }
        }
    });

    await t.test('1. isGmailApiConfigured detects complete credentials correctly', () => {
        delete process.env.GMAIL_CLIENT_ID;
        delete process.env.GMAIL_CLIENT_SECRET;
        delete process.env.GMAIL_REFRESH_TOKEN;
        assert.equal(emailService.isGmailApiConfigured(), false);

        process.env.GMAIL_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
        assert.equal(emailService.isGmailApiConfigured(), false);

        process.env.GMAIL_CLIENT_SECRET = 'test-secret';
        assert.equal(emailService.isGmailApiConfigured(), false);

        process.env.GMAIL_REFRESH_TOKEN = 'test-refresh-token';
        assert.equal(emailService.isGmailApiConfigured(), true);
    });

    await t.test('2. getEmailProviderInfo prioritizes Gmail REST API over Resend and SMTP', () => {
        process.env.GMAIL_CLIENT_ID = 'cid-123';
        process.env.GMAIL_CLIENT_SECRET = 'secret-123';
        process.env.GMAIL_REFRESH_TOKEN = 'refresh-123';
        process.env.GMAIL_USER = 'church@example.com';
        process.env.RESEND_API_KEY = 're_test_key';
        process.env.SMTP_USER = 'smtp@example.com';
        process.env.SMTP_PASS = 'smtp_pass';

        const info = emailService.getEmailProviderInfo();
        assert.equal(info.provider, 'gmail_api');
        assert.equal(info.configured, true);
        assert.ok(info.label.includes('Official Gmail REST API'));
        assert.ok(info.label.includes('HTTPS Port 443'));
        assert.ok(info.label.includes('church@example.com'));
    });

    await t.test('3. Raw email base64url generation via MailComposer is valid RFC 2822', async () => {
        const MailComposer = require('nodemailer/lib/mail-composer');
        const composer = new MailComposer({
            from: '"Church of God World Missions - Imus" <church@example.com>',
            to: 'member@example.com',
            subject: 'Verification Code 123456',
            html: '<h1>Welcome!</h1><p>Please activate your account.</p>',
            text: 'Welcome! Please activate your account.'
        });

        const raw = await new Promise((resolve, reject) => {
            composer.compile().build((err, msg) => {
                if (err) return reject(err);
                resolve(msg.toString('base64url'));
            });
        });

        assert.ok(raw && raw.length > 50, 'Raw base64url string generated');
        const decoded = Buffer.from(raw, 'base64url').toString('utf8');
        assert.ok(decoded.includes('Subject: Verification Code 123456'));
        assert.ok(decoded.includes('To: member@example.com'));
        assert.ok(decoded.includes('church@example.com'));
        assert.ok(decoded.includes('Please activate your account.'));
    });

    await t.test('4. Security: No hardcoded secrets or credentials remain in emailService.js', () => {
        const src = fs.readFileSync(path.join(__dirname, '../utils/emailService.js'), 'utf8');
        assert.equal(src.includes('biay jwxz hoxl qhul'), false, 'Hardcoded app password must not exist');
        assert.equal(src.includes('cogimusdummyacc@gmail.com'), false, 'Hardcoded dummy email must not exist');
    });

    await t.test('5. System settings controller returns correct email settings payload for Gmail API', async () => {
        delete process.env.EMAIL_FROM;
        process.env.GMAIL_CLIENT_ID = 'cid-123';
        process.env.GMAIL_CLIENT_SECRET = 'secret-123';
        process.env.GMAIL_REFRESH_TOKEN = 'refresh-123';
        process.env.GMAIL_USER = 'pastor@example.com';

        const systemController = require('../controllers/systemController');
        let responseData = null;
        const mockRes = {
            status: () => mockRes,
            json: (data) => {
                responseData = data;
                return mockRes;
            }
        };

        await systemController.getEmailSettings({}, mockRes);
        assert.ok(responseData, 'Response returned');
        assert.equal(responseData.success, true);
        assert.equal(responseData.data.provider, 'gmail_api');
        assert.equal(responseData.data.configured, true);
        assert.ok(responseData.data.from.includes('pastor@example.com'));
    });
});
