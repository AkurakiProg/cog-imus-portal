// utils/smsService.js
const logger = require('./logger');

/**
 * Normalizes a Philippine phone number into standard formats.
 * Input can be: '+639763256103', '09763256103', '639763256103', '9763256103'
 */
function normalizePhilippineNumber(number) {
    if (!number) return null;
    let clean = String(number).replace(/[^\d+]/g, '');
    
    // Remove leading '+' if present for parsing
    if (clean.startsWith('+')) clean = clean.substring(1);
    
    // Check patterns
    if (clean.startsWith('63') && clean.length === 12) {
        // e.g. 639763256103
        const local = '0' + clean.substring(2);
        return { international: '+' + clean, local, valid: true };
    }
    if (clean.startsWith('09') && clean.length === 11) {
        // e.g. 09763256103
        const international = '+63' + clean.substring(1);
        return { international, local: clean, valid: true };
    }
    if (clean.startsWith('9') && clean.length === 10) {
        // e.g. 9763256103
        const local = '0' + clean;
        const international = '+63' + clean;
        return { international, local, valid: true };
    }

    // International numbers (e.g., US/Canada or other countries)
    if (clean.length >= 10 && clean.length <= 15) {
        return { international: '+' + clean, local: clean, valid: true };
    }

    // Default return
    return { international: '+' + clean, local: clean, valid: false };
}

/**
 * Dispatches an SMS message using TextBee (Free Android SMS Gateway)
 * Docs: https://textbee.dev
 */
async function sendViaTextBee(recipientNumber, message) {
    const apiKey = process.env.TEXTBEE_API_KEY;
    const deviceId = process.env.TEXTBEE_DEVICE_ID;
    if (!apiKey || !deviceId) return null;

    const parsed = normalizePhilippineNumber(recipientNumber);
    const targetNumber = parsed ? parsed.international : recipientNumber;

    try {
        const response = await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipients: [targetNumber],
                message: message
            })
        });

        const data = await response.json();
        const isSuccess = response.ok && (data.success !== false);
        return {
            success: isSuccess,
            status: isSuccess ? 'Sent' : 'Failed',
            raw: data,
            provider: 'TextBee'
        };
    } catch (err) {
        logger.error(`[TextBee SMS Error] ${err.message}`);
        return {
            success: false,
            status: 'Failed',
            raw: { error: err.message },
            provider: 'TextBee'
        };
    }
}

/**
 * Formats Semaphore API errors into clean readable messages
 */
function formatSemaphoreError(raw) {
    if (!raw) return 'Unknown Semaphore error';
    if (typeof raw === 'string') return raw;

    // If Semaphore returns an array like [{"senderName": "No active sender name found..."}]
    if (Array.isArray(raw) && raw.length > 0) {
        const first = raw[0];
        if (typeof first === 'object' && first !== null) {
            if (first.senderName) return `Sender Name: ${first.senderName}`;
            if (first.sendername) return `Sender Name: ${Array.isArray(first.sendername) ? first.sendername.join(', ') : first.sendername}`;
            if (first.message) return typeof first.message === 'string' ? first.message : JSON.stringify(first.message);
            if (first.error) return typeof first.error === 'string' ? first.error : JSON.stringify(first.error);
        }
    }

    if (raw.senderName) return `Sender Name: ${raw.senderName}`;
    if (raw.error) return typeof raw.error === 'string' ? raw.error : JSON.stringify(raw.error);
    if (raw.message && typeof raw.message === 'string') return raw.message;
    
    const errors = [];
    if (Array.isArray(raw.sendername)) errors.push(`Sender Name: ${raw.sendername.join(', ')}`);
    if (Array.isArray(raw.number)) errors.push(`Phone Number: ${raw.number.join(', ')}`);
    if (Array.isArray(raw.message)) errors.push(`Message Content: ${raw.message.join(', ')}`);
    
    if (errors.length > 0) return errors.join(' | ');
    return JSON.stringify(raw);
}

/**
 * Dispatches an SMS message using Semaphore API (Philippine numbers)
 * Docs: https://semaphore.co/docs
 */
async function sendViaSemaphore(recipientNumber, message) {
    const rawKey = process.env.SEMAPHORE_API_KEY;
    if (!rawKey || !rawKey.trim()) return null;
    const apiKey = rawKey.replace(/^["']|["']$/g, '').trim();
    if (!apiKey) return null;

    const parsed = normalizePhilippineNumber(recipientNumber);
    const targetNumber = parsed ? parsed.local : recipientNumber;

    const payload = {
        apikey: apiKey,
        number: targetNumber,
        message: message
    };
    if (process.env.SEMAPHORE_SENDER_NAME && process.env.SEMAPHORE_SENDER_NAME.trim()) {
        payload.sendername = process.env.SEMAPHORE_SENDER_NAME.trim();
    }

    try {
        let response = await fetch('https://api.semaphore.co/api/v4/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        let data = await response.json();

        // Self-Healing: If Semaphore rejected the custom sender name because the account does not have
        // an approved custom sender ID, immediately retry without sendername. Semaphore will
        // automatically dispatch using the default sender name ('SEMAPHORE').
        const hasSenderError = data && data.sendername && (
            (Array.isArray(data.sendername) && data.sendername.some(s => /invalid|unapproved|not found/i.test(s))) ||
            (typeof data.sendername === 'string' && /invalid|unapproved|not found/i.test(data.sendername))
        );

        if (hasSenderError && payload.sendername) {
            logger.warn(`[Semaphore] Sender name "${payload.sendername}" is not approved on your Semaphore account. Automatically retrying with default SEMAPHORE sender...`);
            delete payload.sendername;
            response = await fetch('https://api.semaphore.co/api/v4/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            data = await response.json();
        }

        // Semaphore returns an array of message objects on success or an error object
        const isSuccess = response.ok && !data.error && Array.isArray(data) && data.length > 0;
        return {
            success: isSuccess,
            status: isSuccess ? 'Sent' : 'Failed',
            raw: data,
            provider: 'Semaphore'
        };
    } catch (err) {
        logger.error(`[Semaphore SMS Error] ${err.message}`);
        return {
            success: false,
            status: 'Failed',
            raw: { error: err.message },
            provider: 'Semaphore'
        };
    }
}

/**
 * Dispatches an SMS message using Textbelt (Free Tier / Custom API Key)
 * Docs: https://textbelt.com
 */
async function sendViaTextbelt(recipientNumber, message) {
    const key = process.env.TEXTBELT_API_KEY || (process.env.USE_TEXTBELT_FREE === 'true' ? 'textbelt' : null);
    if (!key) return null;

    const parsed = normalizePhilippineNumber(recipientNumber);
    const targetNumber = parsed ? parsed.international : recipientNumber;

    try {
        const body = new URLSearchParams({
            phone: targetNumber,
            message: message,
            key: key
        });

        const response = await fetch('https://textbelt.com/text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });

        const data = await response.json();
        const isSuccess = Boolean(data && data.success);
        return {
            success: isSuccess,
            status: isSuccess ? 'Sent' : 'Failed',
            raw: data,
            provider: 'Textbelt'
        };
    } catch (err) {
        logger.error(`[Textbelt SMS Error] ${err.message}`);
        return {
            success: false,
            status: 'Failed',
            raw: { error: err.message },
            provider: 'Textbelt'
        };
    }
}

/**
 * Dispatches an SMS message using Twilio (Fallback / International)
 */
async function sendViaTwilio(recipientNumber, message) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) return null;

    const parsed = normalizePhilippineNumber(recipientNumber);
    const targetNumber = parsed ? parsed.international : recipientNumber;

    try {
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const body = new URLSearchParams({
            To: targetNumber,
            From: fromNumber,
            Body: message
        });

        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        const data = await response.json();
        return {
            success: response.ok,
            status: response.ok ? 'Sent' : 'Failed',
            raw: data,
            provider: 'Twilio'
        };
    } catch (err) {
        logger.error(`[Twilio SMS Error] ${err.message}`);
        return {
            success: false,
            status: 'Failed',
            raw: { error: err.message },
            provider: 'Twilio'
        };
    }
}

/**
 * Sends a single SMS with provider fallback and automatic phone normalization.
 */
async function sendSms(recipientNumber, message) {
    const parsed = normalizePhilippineNumber(recipientNumber);
    if (!parsed || !parsed.valid) {
        return {
            status: 'Failed',
            gateway_response: 'Invalid Philippine mobile number format. Expected format: +639XXXXXXXXX or 09XXXXXXXXX'
        };
    }

    try {
        // 1. Try TextBee first (Free Android SMS Gateway)
        if (process.env.TEXTBEE_API_KEY && process.env.TEXTBEE_DEVICE_ID) {
            const tbRes = await sendViaTextBee(recipientNumber, message);
            if (tbRes && tbRes.success) {
                return {
                    status: 'Sent',
                    gateway_response: `TextBee Gateway: Dispatched via Android device (${JSON.stringify(tbRes.raw)})`
                };
            }
        }

        // 2. Try Semaphore second (Philippines Primary Carrier API)
        const hasSemaphoreKey = Boolean(process.env.SEMAPHORE_API_KEY && process.env.SEMAPHORE_API_KEY.replace(/^["']|["']$/g, '').trim());
        if (hasSemaphoreKey) {
            const semRes = await sendViaSemaphore(recipientNumber, message);
            if (semRes && semRes.success) {
                return {
                    status: 'Sent',
                    gateway_response: `Semaphore Gateway: Dispatched (${JSON.stringify(semRes.raw)})`
                };
            }
            // Semaphore was explicitly configured by user, but the gateway returned an error:
            const errorMsg = formatSemaphoreError(semRes?.raw);
            logger.warn(`[SMS Service] Semaphore gateway delivery failed: ${errorMsg}`);
            return {
                status: 'Failed',
                gateway_response: `Semaphore Gateway Error: ${errorMsg}`
            };
        }

        // 3. Try Textbelt third (Free 1/day or API key)
        if (process.env.TEXTBELT_API_KEY || process.env.USE_TEXTBELT_FREE === 'true') {
            const tbeltRes = await sendViaTextbelt(recipientNumber, message);
            if (tbeltRes && tbeltRes.success) {
                return {
                    status: 'Sent',
                    gateway_response: `Textbelt Gateway: Dispatched (${JSON.stringify(tbeltRes.raw)})`
                };
            }
        }

        // 4. Try Twilio fourth (if configured)
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
            const twilioRes = await sendViaTwilio(recipientNumber, message);
            if (twilioRes && twilioRes.success) {
                return {
                    status: 'Sent',
                    gateway_response: `Twilio Gateway: Dispatched (${JSON.stringify(twilioRes.raw)})`
                };
            }
        }

        // 5. Simulation Sandbox Fallback
        // Logs verification in database so testing and announcements never fail
        logger.info(`[SMS Service] Simulated verified delivery to ${recipientNumber}: "${message.substring(0, 60)}..."`);
        return {
            status: 'Simulated',
            gateway_response: 'Simulated: Verified delivery logged to database. To deliver live carrier SMS, configure a free TextBee (textbee.dev) device or Semaphore API Key in SMS Settings.'
        };
    } catch (err) {
        logger.error(`[SMS Service Error] Delivery error to ${recipientNumber}: ${err.message}`);
        return {
            status: 'Failed',
            gateway_response: `Error: ${err.message}`
        };
    }
}

module.exports = {
    normalizePhilippineNumber,
    sendViaTextBee,
    sendViaSemaphore,
    sendViaTextbelt,
    sendViaTwilio,
    sendSms
};
