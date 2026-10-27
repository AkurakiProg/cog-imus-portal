const fs = require('fs');
const path = require('path');
const systemModel = require('../models/systemModel');
const userModel = require('../models/userModel');
const { pool } = require('../config/database');
const { sendSms, normalizePhilippineNumber } = require('../utils/smsService');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

function updateEnvFile(updates) {
    const envPath = path.join(__dirname, '../.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    for (const [key, value] of Object.entries(updates)) {
        process.env[key] = value || '';
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}="${value || ''}"`);
        } else {
            envContent += `\n${key}="${value || ''}"`;
        }
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
}

exports.getEmailSettings = async (req, res) => {
    try {
        const { getEmailProviderInfo, resolveFromAddress } = require('../utils/emailService');
        const info = getEmailProviderInfo();
        return successResponse(res, {
            provider: info.provider,
            configured: info.configured,
            label: info.label,
            from: resolveFromAddress(info.provider)
        }, 'Email settings retrieved');
    } catch (error) {
        console.error('getEmailSettings Error:', error);
        return errorResponse(res, 'Failed to fetch email settings: ' + error.message, 500);
    }
};

exports.backupDatabase = async (req, res) => {
    try {
        const backupData = await systemModel.getBackupData();
        
        await userModel.logAudit(req.user.id, 'BACKUP', 'System', null, null, { message: 'Downloaded database backup' }, req.ip, req.headers['user-agent']);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="church_portal_backup_${new Date().toISOString().split('T')[0]}.json"`);
        
        return res.status(200).json(backupData);
    } catch (error) {
        console.error('Backup Database Error:', error);
        return errorResponse(res, 'Failed to generate database backup.', 500);
    }
};

exports.getSmsSettings = async (req, res) => {
    try {
        const hasTextBee = Boolean(process.env.TEXTBEE_API_KEY && process.env.TEXTBEE_DEVICE_ID);
        const hasSemaphore = Boolean(process.env.SEMAPHORE_API_KEY && process.env.SEMAPHORE_API_KEY.trim());
        const hasTextbelt = Boolean(process.env.TEXTBELT_API_KEY || process.env.USE_TEXTBELT_FREE === 'true');
        const hasTwilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);

        let activeProvider = 'Simulation Mode (Sandbox Verification)';
        if (hasTextBee) activeProvider = 'TextBee (Free Android SMS Gateway)';
        else if (hasSemaphore) activeProvider = 'Semaphore (Philippines)';
        else if (hasTextbelt) activeProvider = 'Textbelt';
        else if (hasTwilio) activeProvider = 'Twilio (International)';

        const maskKey = (key, start = 4, end = 4) => {
            if (!key) return '';
            const trimmed = String(key).trim();
            if (trimmed.length <= start + end) return '••••••••';
            return `${trimmed.substring(0, start)}••••••••${trimmed.slice(-end)}`;
        };

        const [statsRows] = await pool.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'Sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status = 'Simulated' THEN 1 ELSE 0 END) as simulated,
                SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failed
            FROM sms_logs
        `);

        const [recentLogs] = await pool.execute(`
            SELECT sms_id, recipient_number, recipient_name, message_content, status, gateway_response, sent_at
            FROM sms_logs
            ORDER BY sms_id DESC
            LIMIT 6
        `);

        return successResponse(res, {
            configured: hasTextBee || hasSemaphore || hasTextbelt || hasTwilio,
            provider: activeProvider,
            has_textbee: hasTextBee,
            textbee_api_key_masked: maskKey(process.env.TEXTBEE_API_KEY),
            textbee_device_id_masked: maskKey(process.env.TEXTBEE_DEVICE_ID),
            has_semaphore: hasSemaphore,
            semaphore_api_key_masked: maskKey(process.env.SEMAPHORE_API_KEY),
            semaphore_sender_name: process.env.SEMAPHORE_SENDER_NAME || 'COGWM',
            has_textbelt: hasTextbelt,
            textbelt_api_key_masked: maskKey(process.env.TEXTBELT_API_KEY),
            use_textbelt_free: process.env.USE_TEXTBELT_FREE === 'true',
            has_twilio: hasTwilio,
            twilio_account_sid_masked: maskKey(process.env.TWILIO_ACCOUNT_SID, 6, 4),
            twilio_phone_number: process.env.TWILIO_PHONE_NUMBER || '',
            stats: {
                total: statsRows[0]?.total || 0,
                sent: Number(statsRows[0]?.sent || 0),
                simulated: Number(statsRows[0]?.simulated || 0),
                failed: Number(statsRows[0]?.failed || 0)
            },
            recent_logs: recentLogs
        }, 'SMS settings retrieved');
    } catch (error) {
        console.error('getSmsSettings Error:', error);
        return errorResponse(res, 'Failed to fetch SMS settings.', 500);
    }
};

exports.updateSmsSettings = async (req, res) => {
    try {
        const {
            textbee_api_key,
            textbee_device_id,
            semaphore_api_key,
            semaphore_sender_name,
            textbelt_api_key,
            use_textbelt_free,
            twilio_account_sid,
            twilio_auth_token,
            twilio_phone_number
        } = req.body;

        const updates = {};
        if (textbee_api_key !== undefined) updates.TEXTBEE_API_KEY = textbee_api_key.trim();
        if (textbee_device_id !== undefined) updates.TEXTBEE_DEVICE_ID = textbee_device_id.trim();
        if (semaphore_api_key !== undefined) updates.SEMAPHORE_API_KEY = semaphore_api_key.trim();
        if (semaphore_sender_name !== undefined) updates.SEMAPHORE_SENDER_NAME = semaphore_sender_name.trim();
        if (textbelt_api_key !== undefined) updates.TEXTBELT_API_KEY = textbelt_api_key.trim();
        if (use_textbelt_free !== undefined) updates.USE_TEXTBELT_FREE = String(use_textbelt_free);
        if (twilio_account_sid !== undefined) updates.TWILIO_ACCOUNT_SID = twilio_account_sid.trim();
        if (twilio_auth_token !== undefined) updates.TWILIO_AUTH_TOKEN = twilio_auth_token.trim();
        if (twilio_phone_number !== undefined) updates.TWILIO_PHONE_NUMBER = twilio_phone_number.trim();

        updateEnvFile(updates);

        await userModel.logAudit(
            req.user.id, 'UPDATE_SMS_SETTINGS', 'System', null, 
            null, { updated_keys: Object.keys(updates) }, 
            req.ip, req.headers['user-agent']
        );

        return successResponse(res, null, 'SMS settings saved successfully.');
    } catch (error) {
        console.error('updateSmsSettings Error:', error);
        return errorResponse(res, 'Failed to update SMS settings: ' + error.message, 500);
    }
};

exports.sendTestSms = async (req, res) => {
    try {
        const { recipient_number, message } = req.body;
        if (!recipient_number) {
            return errorResponse(res, 'Please provide a valid recipient phone number.', 400);
        }

        const norm = normalizePhilippineNumber(recipient_number);
        if (!norm || !norm.valid) {
            return errorResponse(res, 'Invalid Philippine phone number format. Use +639XXXXXXXXX or 09XXXXXXXXX', 400);
        }

        const testMsg = message && message.trim() 
            ? message.trim() 
            : `[COG Imus] Live SMS Gateway Test dispatched at ${new Date().toLocaleTimeString('en-US')}. Praise the Lord!`;

        const smsResult = await sendSms(recipient_number, testMsg);

        await pool.execute(
            `INSERT INTO sms_logs (announcement_id, recipient_number, recipient_name, message_content, status, gateway_response, triggered_by)
             VALUES (NULL, ?, 'Gateway Test Recipient', ?, ?, ?, ?)`,
            [recipient_number, testMsg, smsResult.status, smsResult.gateway_response, req.user.id]
        );

        await userModel.logAudit(
            req.user.id, 'TEST_SMS', 'System', null,
            null, { recipient: recipient_number, status: smsResult.status, response: smsResult.gateway_response },
            req.ip, req.headers['user-agent']
        );

        let userMsg = '';
        if (smsResult.status === 'Sent') {
            userMsg = `Success: SMS dispatched over cellular gateway to ${recipient_number}!`;
        } else if (smsResult.status === 'Simulated') {
            userMsg = `Simulation Mode: No API key is configured in .env. SMS logged in database, but not transmitted to physical mobile carrier.`;
        } else {
            userMsg = `Gateway Response: ${smsResult.gateway_response || 'Failed to dispatch SMS'}`;
        }

        return successResponse(res, {
            status: smsResult.status,
            recipient: recipient_number,
            gateway_response: smsResult.gateway_response
        }, userMsg);

    } catch (error) {
        console.error('sendTestSms Error:', error);
        return errorResponse(res, 'Failed to send test SMS: ' + error.message, 500);
    }
};