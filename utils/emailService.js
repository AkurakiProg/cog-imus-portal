require('dotenv').config();
const nodemailer = require('nodemailer');

let transporterInstance = null;

/**
 * Obtain or initialize the Nodemailer transporter for Gmail SMTP.
 */
function getTransporter() {
    if (transporterInstance) return transporterInstance;

    const user = process.env.SMTP_USER;
    const rawPass = process.env.SMTP_PASS;
    
    if (!user || !rawPass) {
        throw new Error('SMTP credentials are not configured. Please set SMTP_USER and SMTP_PASS in your environment configuration.');
    }

    // Clean spaces from Google App Password if present
    const pass = rawPass.replace(/\s+/g, '');

    transporterInstance = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: user,
            pass: pass
        }
    });

    return transporterInstance;
}

/**
 * Verify SMTP connection configuration.
 */
async function verifySmtp() {
    const transporter = getTransporter();
    try {
        await transporter.verify();
        return { success: true, message: 'SMTP connection verified successfully.' };
    } catch (err) {
        return { success: false, message: err.message };
    }
}

/**
 * Send an official Account Verification / Activation email to a user.
 */
async function sendAccountVerificationEmail({ to, fullName, username, roleName = 'Church Member', activationLink = null }) {
    if (!to) {
        throw new Error('Recipient email address is required.');
    }

    const transporter = getTransporter();
    const portalUrl = process.env.PORTAL_URL || 'http://localhost:5000';
    const loginUrl = `${portalUrl}/views/login.html`;
    const actionUrl = activationLink || loginUrl;
    const isActivation = Boolean(activationLink);
    const fromAddress = process.env.EMAIL_FROM || (process.env.SMTP_USER ? `"Church of God World Missions - Imus" <${process.env.SMTP_USER}>` : '"Church of God World Missions - Imus" <noreply@cogwmphimus.org>');

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isActivation ? 'Action Required: Activate Your Account' : 'Account Verified'} - COGWM Imus Portal</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 40px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #0b1d3a 0%, #1e3a8a 100%); padding: 32px 30px; text-align: center;">
                            <div style="font-size: 32px; margin-bottom: 8px;">✝️</div>
                            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">Church of God World Missions</h1>
                            <p style="color: #93c5fd; margin: 6px 0 0; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 1.5px;">Imus, Cavite • Church Portal</p>
                        </td>
                    </tr>

                    <!-- Verification Banner -->
                    <tr>
                        <td style="background-color: ${isActivation ? '#fef3c7' : '#ecfdf5'}; border-bottom: 1px solid ${isActivation ? '#fde68a' : '#a7f3d0'}; padding: 14px 30px; text-align: center;">
                            <span style="display: inline-block; color: ${isActivation ? '#92400e' : '#047857'}; font-weight: 600; font-size: 14px;">
                                ${isActivation ? '🔔 Action Required: Verify & Activate Account' : '✅ Account Verification Confirmed'}
                            </span>
                        </td>
                    </tr>

                    <!-- Main Body -->
                    <tr>
                        <td style="padding: 36px 32px 28px;">
                            <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a;">
                                Welcome, ${fullName || 'Valued Member'}!
                            </h2>
                            <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #475569;">
                                ${isActivation 
                                    ? 'An administrator has reviewed your account for the <strong>Church of God World Missions - Imus Portal</strong>. To complete your registration and activate your account, please click the button below to verify your email address.'
                                    : 'We are pleased to inform you that your account on the <strong>Church of God World Missions - Imus Portal</strong> has been officially reviewed and <strong style="color: #059669;">verified</strong> by the Church Administration.'
                                }
                            </p>
                            <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #475569;">
                                ${isActivation 
                                    ? 'Once verified, your account will be fully activated and you will have authorized access to sermons, events, announcements, WORDA ministries, and church portal services.'
                                    : 'You now have full authorized access to the church portal, including sermons, events, announcements, WORDA departments, and member records.'
                                }
                            </p>

                            <!-- Account Details Card -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 28px;">
                                <tr>
                                    <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                                        <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Account Summary</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 14px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px;">
                                        <strong style="color: #334155; width: 120px; display: inline-block;">Username:</strong>
                                        <code style="background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #0f172a;">${username}</code>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 14px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px;">
                                        <strong style="color: #334155; width: 120px; display: inline-block;">Email:</strong>
                                        <span style="color: #0f172a;">${to}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 14px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px;">
                                        <strong style="color: #334155; width: 120px; display: inline-block;">Portal Role:</strong>
                                        <span style="background-color: #dbeafe; color: #1e40af; font-weight: 600; font-size: 12px; padding: 3px 8px; border-radius: 10px;">${roleName}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 14px 20px; font-size: 14px;">
                                        <strong style="color: #334155; width: 120px; display: inline-block;">Status:</strong>
                                        <span style="color: ${isActivation ? '#d97706' : '#059669'}; font-weight: 600;">
                                            ${isActivation ? '⏳ Pending Verification' : '● Active & Verified'}
                                        </span>
                                    </td>
                                </tr>
                            </table>

                            <!-- Call to Action -->
                            <div style="text-align: center; margin: 32px 0 24px;">
                                <a href="${actionUrl}" target="_blank" style="display: inline-block; background: ${isActivation ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'}; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 16px 40px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.15); letter-spacing: 0.3px;">
                                    ${isActivation ? 'Verify & Activate My Account →' : 'Log In to Church Portal →'}
                                </a>
                            </div>

                            ${isActivation ? `
                            <p style="margin: 0 0 16px; font-size: 12px; color: #64748b; text-align: center;">
                                ⏱️ This verification link will expire in 24 hours.
                            </p>
                            ` : ''}

                            <p style="margin: 0; font-size: 13px; color: #94a3b8; text-align: center; line-height: 1.5;">
                                Button not working? Copy and paste this link into your browser:<br>
                                <a href="${actionUrl}" style="color: #2563eb; word-break: break-all;">${actionUrl}</a>
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 30px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.6;">
                            <p style="margin: 0 0 6px;"><strong>Church of God World Missions Philippines - Imus</strong></p>
                            <p style="margin: 0 0 6px;">Official Church Administration Portal System</p>
                            <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                                This is an automated notification. If you did not create an account or believe you received this in error, please contact the Church Administrator immediately.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;

    const textContent = `
Church of God World Missions Philippines - Imus
${isActivation ? 'Account Verification & Activation Required' : 'Church Portal Account Verification'}

Hello, ${fullName || 'Valued Member'}!

${isActivation 
    ? 'An administrator has reviewed your account. Please click the link below to verify your email address and activate your account:'
    : 'We are pleased to inform you that your account on the Church Portal has been officially verified by the Church Administration.'
}

Account Summary:
- Username: ${username}
- Email: ${to}
- Portal Role: ${roleName}
- Status: ${isActivation ? 'Pending Verification' : 'Active & Verified'}

${isActivation ? 'Click here to verify and activate your account (valid for 24 hours):' : 'You can log in to the portal at:'}
${actionUrl}

Blessings,
Church of God World Missions Philippines - Imus
    `.trim();

    const info = await transporter.sendMail({
        from: fromAddress,
        to: to,
        subject: isActivation ? 'Action Required: Verify & Activate Your Church of God Imus Account' : 'Account Verified - Church of God Imus Portal',
        text: textContent,
        html: htmlContent
    });

    console.log(`[EMAIL SERVICE] ${isActivation ? 'Activation' : 'Verification'} email sent to ${to}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
}

/**
 * Send an official Church Announcement email broadcast to a church member.
 */
async function sendAnnouncementEmail({ to, recipientName, title, content, category = 'General', department = 'Church Administration', publishDate = new Date() }) {
    if (!to) {
        throw new Error('Recipient email address is required.');
    }

    const transporter = getTransporter();
    const portalUrl = process.env.PORTAL_URL || 'http://localhost:5000';
    const fromAddress = process.env.EMAIL_FROM || (process.env.SMTP_USER ? `"Church of God World Missions - Imus" <${process.env.SMTP_USER}>` : '"Church of God World Missions - Imus" <noreply@cogwmphimus.org>');
    const dateFormatted = new Date(publishDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Church of God Imus</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 30px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #0b1d3a 0%, #1e3a8a 100%); padding: 28px 30px; text-align: center;">
                            <div style="font-size: 28px; margin-bottom: 6px;">📢</div>
                            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">Church of God World Missions</h1>
                            <p style="color: #93c5fd; margin: 4px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px;">Imus, Cavite • Official Announcement</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 28px 32px;">
                            <div style="display: inline-block; padding: 4px 10px; background-color: #fef3c7; color: #b45309; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                                ${category} • ${department || 'Church Administration'}
                            </div>
                            <h2 style="margin: 0 0 10px; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                                ${title}
                            </h2>
                            <p style="font-size: 13px; color: #64748b; margin: 0 0 20px;">
                                Date: <strong>${dateFormatted}</strong> | Dear <strong>${recipientName || 'Church Member'}</strong>,
                            </p>
                            <div style="padding: 18px 20px; background-color: #f8fafc; border-left: 4px solid #0E2A4F; border-radius: 6px; font-size: 14px; line-height: 1.7; color: #334155; white-space: pre-line; margin-bottom: 24px;">
${content}
                            </div>
                            <div style="text-align: center; margin: 24px 0 12px;">
                                <a href="${portalUrl}/views/login.html" target="_blank" style="display: inline-block; background: #0E2A4F; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 6px;">
                                    View on Church Portal &rarr;
                                </a>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
                            <p style="margin: 0 0 4px;"><strong>Church of God World Missions Philippines - Imus</strong></p>
                            <p style="margin: 0;">Stay connected with our church body in faith, worship, and fellowship.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;

    const textContent = `
[COGWM Imus Announcement]
Title: ${title}
Category: ${category}
Date: ${dateFormatted}

Dear ${recipientName || 'Church Member'},

${content}

View online on the church portal: ${portalUrl}
    `.trim();

    try {
        const info = await transporter.sendMail({
            from: fromAddress,
            to: to,
            subject: `[Announcement] ${title} - Church of God Imus`,
            text: textContent,
            html: htmlContent
        });

        console.log(`[EMAIL SERVICE] Announcement email delivered to ${to}. Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId, status: 'Sent' };
    } catch (err) {
        console.warn(`[EMAIL SERVICE] Failed delivering to ${to}: ${err.message}`);
        return { success: false, error: err.message, status: 'Failed' };
    }
}

/**
 * Dispatches a Contact Inquiry / Prayer Request email directly to the pastoral/admin recipient.
 */
async function sendContactPrayerEmail({ name, email, contact_number, subject, message }) {
    const transporter = getTransporter();
    if (!transporter) {
        console.warn('[EMAIL SERVICE] SMTP transporter unavailable for contact/prayer request.');
        return { success: false, error: 'SMTP transporter not configured.' };
    }

    const recipient = process.env.CONTACT_RECIPIENT_EMAIL || process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'info@cogwmphimus.org';
    const isPrayer = String(subject || '').toLowerCase().includes('prayer') || String(message || '').toLowerCase().includes('pray');
    const badgeLabel = isPrayer ? 'PRAYER REQUEST' : 'CONTACT MESSAGE';
    const badgeColor = isPrayer ? '#7c3aed' : '#2563eb';

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>New Message / Prayer Request</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
            .header { background: #0c2340; color: #ffffff; padding: 25px 30px; border-bottom: 3px solid #c9a961; }
            .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; }
            .header p { margin: 5px 0 0; color: #c9a961; font-size: 13px; font-weight: 500; }
            .badge { display: inline-block; background: ${badgeColor}; color: #ffffff; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 12px; }
            .body { padding: 30px; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
            .info-table td { padding: 10px 14px; font-size: 14px; }
            .info-table td.label { width: 140px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
            .info-table td.val { color: #0f172a; font-weight: 500; border-bottom: 1px solid #e2e8f0; }
            .info-table tr:last-child td { border-bottom: none; }
            .message-box { background: #fefce8; border-left: 4px solid #eab308; padding: 16px 18px; border-radius: 6px; font-size: 15px; line-height: 1.6; color: #1e293b; white-space: pre-wrap; margin-bottom: 25px; }
            .action-btn { display: inline-block; background: #0c2340; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; border: 1px solid #c9a961; }
            .footer { background: #f8fafc; padding: 16px 30px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Church of God World Missions &bull; Imus</h1>
                <p>Official Website Inquiry & Pastoral Portal</p>
            </div>
            <div class="body">
                <span class="badge">${badgeLabel}</span>
                <h2 style="margin: 0 0 16px; color: #0c2340; font-size: 18px;">${escapeHtmlEmail(subject || 'General Inquiry')}</h2>

                <table class="info-table">
                    <tr>
                        <td class="label">From:</td>
                        <td class="val"><strong>${escapeHtmlEmail(name)}</strong></td>
                    </tr>
                    <tr>
                        <td class="label">Email Address:</td>
                        <td class="val"><a href="mailto:${escapeHtmlEmail(email)}" style="color: #2563eb; text-decoration: underline;">${escapeHtmlEmail(email)}</a></td>
                    </tr>
                    <tr>
                        <td class="label">Phone / Mobile:</td>
                        <td class="val">${escapeHtmlEmail(contact_number || 'Not provided')}</td>
                    </tr>
                    <tr>
                        <td class="label">Submitted:</td>
                        <td class="val">${new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'short' })} PHT</td>
                    </tr>
                </table>

                <h3 style="font-size: 14px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin: 0 0 8px;">Message Content:</h3>
                <div class="message-box">${escapeHtmlEmail(message)}</div>

                <div style="text-align: center;">
                    <a href="mailto:${escapeHtmlEmail(email)}?subject=Re:%20${encodeURIComponent(subject || 'Your Message to COGWM Imus')}" class="action-btn">
                        &larr; Reply Directly to ${escapeHtmlEmail(name)}
                    </a>
                </div>
            </div>
            <div class="footer">
                This email was generated automatically by the COGWM Imus Portal Contact & Prayer Request Form.<br>
                Recipient: ${recipient}
            </div>
        </div>
    </body>
    </html>
    `;

    const textContent = `
========================================
[COGWM IMUS] ${badgeLabel}
========================================
Subject: ${subject || 'General Inquiry'}
From: ${name}
Email: ${email}
Contact Number: ${contact_number || 'None'}
Date: ${new Date().toLocaleString()}

Message:
${message}
========================================
`;

    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || `"COGWM Imus Portal" <${process.env.SMTP_USER || 'noreply@cogwmphimus.org'}>`,
            to: recipient,
            replyTo: `"${name}" <${email}>`,
            subject: `[COGWM Imus] ${badgeLabel}: ${subject || 'New Submission'} - from ${name}`,
            text: textContent,
            html: htmlContent
        });

        console.log(`[EMAIL SERVICE] Contact/Prayer request delivered to ${recipient}. Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId, status: 'Sent' };
    } catch (err) {
        console.error(`[EMAIL SERVICE] Error sending contact/prayer request: ${err.message}`);
        return { success: false, error: err.message, status: 'Failed' };
    }
}

function escapeHtmlEmail(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

module.exports = {
    getTransporter,
    verifySmtp,
    sendAccountVerificationEmail,
    sendAnnouncementEmail,
    sendContactPrayerEmail
};
