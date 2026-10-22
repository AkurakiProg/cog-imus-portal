require('dotenv').config();
const crypto = require('crypto');

/**
 * Derives or retrieves the 32-byte encryption key for AES-256-GCM.
 * Prioritizes MFA_ENCRYPTION_KEY, with fallback to SHA-256(JWT_SECRET).
 */
function getEncryptionKey() {
    const rawKey = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!rawKey) {
        throw new Error('MFA_ENCRYPTION_KEY or JWT_SECRET must be configured.');
    }
    // If it's a 64-character hex string, parse directly into 32-byte Buffer
    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
        return Buffer.from(rawKey, 'hex');
    }
    // Otherwise derive a deterministic 32-byte key via SHA-256
    return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts a string (e.g. TOTP secret) using AES-256-GCM authenticated encryption.
 * Returns payload formatted as `iv:authTag:ciphertext` in hex.
 */
function encryptSecret(plainText) {
    if (!plainText) return null;
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM payload formatted as `iv:authTag:ciphertext`.
 */
function decryptSecret(encryptedPayload) {
    if (!encryptedPayload) return null;
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
        throw new Error('Malformed encrypted payload format.');
    }

    const [ivHex, authTagHex, dataHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(dataHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

/**
 * Hashes a recovery code for secure database storage.
 * Code is normalized (spaces and hyphens removed, uppercased) and hashed via HMAC-SHA256 with the encryption key.
 */
function hashRecoveryCode(code) {
    if (!code) return null;
    const normalized = String(code).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const key = getEncryptionKey();
    return crypto.createHmac('sha256', key).update(normalized).digest('hex');
}

/**
 * Generates an array of unpredictable recovery codes formatted as `XXXX-XXXX`.
 */
function generateRecoveryCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        const buf = crypto.randomBytes(5);
        const hex = buf.toString('hex').toUpperCase();
        codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`);
    }
    return codes;
}

module.exports = {
    encryptSecret,
    decryptSecret,
    hashRecoveryCode,
    generateRecoveryCodes
};
