require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const { encryptSecret, decryptSecret, generateRecoveryCodes, hashRecoveryCode } = require('../utils/cryptoHelper');
const { normalizePhilippineNumber } = require('../utils/smsService');

test('Crypto Helper: AES-256-GCM encrypt and decrypt round-trip', () => {
    const plainText = 'JBSWY3DPEHPK3PXP'; // Standard Base32 TOTP secret
    const encrypted = encryptSecret(plainText);
    
    assert.ok(encrypted, 'Encrypted string should exist');
    assert.notEqual(encrypted, plainText, 'Encrypted string should differ from plain text');
    assert.ok(encrypted.includes(':'), 'Encrypted string should contain IV separator');
    
    const decrypted = decryptSecret(encrypted);
    assert.equal(decrypted, plainText, 'Decrypted secret should match original plain text');
});

test('Crypto Helper: Decrypting empty payload returns null', () => {
    assert.equal(decryptSecret(''), null, 'Empty string returns null');
    assert.equal(decryptSecret(null), null, 'Null returns null');
});

test('Crypto Helper: Decrypting tampered or malformed payload throws Error', () => {
    assert.throws(() => decryptSecret('invalid_payload_without_colon'), /Malformed encrypted payload/);
    assert.throws(() => decryptSecret('deadbeef:badtag:deadbeef'));
});

test('Crypto Helper: MFA Recovery Codes generation and hashing', () => {
    const codes = generateRecoveryCodes(8);
    assert.equal(codes.length, 8, 'Should generate exactly 8 recovery codes');
    
    for (const code of codes) {
        assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'Recovery code should match format XXXX-XXXX');
        const hash = hashRecoveryCode(code);
        assert.ok(hash && hash.length === 64, 'SHA-256 hash should be 64 hex characters');
        
        // Test case and hyphen insensitivity
        const lowerNoHyphen = code.replace('-', '').toLowerCase();
        const hashNormalized = hashRecoveryCode(lowerNoHyphen);
        assert.equal(hash, hashNormalized, 'Hash should normalize hyphens and case');
    }
});

test('SMS Service: Philippine phone number normalization', () => {
    const cases = [
        { input: '09171234567', expectedInt: '+639171234567', expectedLocal: '09171234567', valid: true },
        { input: '+639171234567', expectedInt: '+639171234567', expectedLocal: '09171234567', valid: true },
        { input: '639171234567', expectedInt: '+639171234567', expectedLocal: '09171234567', valid: true },
        { input: '9171234567', expectedInt: '+639171234567', expectedLocal: '09171234567', valid: true },
        { input: '0917 123 4567', expectedInt: '+639171234567', expectedLocal: '09171234567', valid: true }
    ];

    for (const c of cases) {
        const res = normalizePhilippineNumber(c.input);
        assert.ok(res, `Result should exist for ${c.input}`);
        assert.equal(res.valid, c.valid, `Valid status should match for ${c.input}`);
        assert.equal(res.international, c.expectedInt, `International number should match for ${c.input}`);
        assert.equal(res.local, c.expectedLocal, `Local number should match for ${c.input}`);
    }
});
