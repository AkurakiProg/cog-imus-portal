require('dotenv').config();
const nodemailer = require('nodemailer');
const { Resend } = require('resend');

let transporterInstance = null;
let resendClient = null;

/**
 * Validate standard email address format
 */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Obtain or initialize the official Resend client
 */
function getResendClient() {
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    if (!apiKey) return null;
    if (!resendClient) {
        resendClient = new Resend(apiKey);
    }
    return resendClient;
}

/**
 * Obtain or initialize the Nodemailer transporter for Gmail / SMTP fallback.
 */
function getTransporter() {
    if (transporterInstance) return transporterInstance;

    const user = process.env.SMTP_USER;
    const rawPass = process.env.SMTP_PASS;

    if (!user || !rawPass) {
        return null;
    }

    // Clean spaces from Google App Password if present
    const pass = rawPass.replace(/\s+/g, '');

    transporterInstance = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: user,
            pass: pass
        },
        connectionTimeout: 6000,
        greetingTimeout: 6000,
        socketTimeout: 8000
    });

    return transporterInstance;
}

/**
 * Determine currently active email service provider
 */
function getEmailProviderInfo() {
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) {
        return {
            provider: 'resend',
            configured: true,
            label: 'Resend.com API (HTTPS Port 443)'
        };
    }
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        return {
            provider: 'smtp',
            configured: true,
            label: `Gmail SMTP (${process.env.SMTP_USER})`
        };
    }
    return {
        provider: 'none',
        configured: false,
        label: 'Not Configured (Simulation Mode)'
    };
}

/**
 * Verify email service configuration (Resend or SMTP).
 */
async function verifyEmailService() {
    const providerInfo = getEmailProviderInfo();
    if (providerInfo.provider === 'resend') {
        const resend = getResendClient();
        if (!resend) return { success: false, provider: 'resend', message: 'Resend API key is missing or blank.' };
        return {
            success: true,
            provider: 'resend',
            message: 'Resend.com API is active. Real-time delivery enabled over HTTPS (Port 443).'
        };
    } else if (providerInfo.provider === 'smtp') {
        return await verifySmtp();
    } else {
        return {
            success: false,
            provider: 'none',
            message: 'No email provider configured. Please set RESEND_API_KEY in environment configuration.'
        };
    }
}

/**
 * Verify SMTP connection configuration (Nodemailer fallback).
 */
async function verifySmtp() {
    const transporter = getTransporter();
    if (!transporter) {
        return { success: false, provider: 'smtp', message: 'SMTP credentials (SMTP_USER/SMTP_PASS) are not set.' };
    }
    try {
        await transporter.verify();
        return { success: true, provider: 'smtp', message: 'SMTP connection verified successfully.' };
    } catch (err) {
        return { success: false, provider: 'smtp', message: err.message };
    }
}

/**
 * Resolve verified sender address
 */
function resolveFromAddress(provider) {
    if (provider === 'resend') {
        return (
            process.env.RESEND_FROM ||
            process.env.EMAIL_FROM ||
            'Church of God Imus <onboarding@resend.dev>'
        );
    }
    return (
        process.env.EMAIL_FROM ||
        (process.env.SMTP_USER ? `"Church of God World Missions - Imus" <${process.env.SMTP_USER}>` : '"Church of God World Missions - Imus" <info@cogwmphimus.org>')
    );
}

/**
 * Core Real-Time Email Dispatcher:
 * Automatically uses Resend API (Port 443) when RESEND_API_KEY is configured;
 * gracefully falls back to Nodemailer SMTP when Resend is not set.
 */
async function sendEmail({ to, subject, html, text, from = null, replyTo = null }) {
    if (!to) {
        throw new Error('Recipient email address is required.');
    }

    const recipients = Array.isArray(to) ? to.map(e => String(e).trim()) : [String(to).trim()];
    for (const email of recipients) {
        if (!isValidEmail(email)) {
            throw new Error(`Invalid recipient email address: "${email}"`);
        }
    }

    const plainText = text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
    const resend = getResendClient();

    // 1. Primary: Resend API (HTTPS Port 443 - zero SMTP port blocking)
    if (resend) {
        const fromAddress = from || resolveFromAddress('resend');
        const payload = {
            from: fromAddress,
            to: recipients,
            subject: subject,
            html: html,
            text: plainText
        };
        if (replyTo && isValidEmail(replyTo)) {
            payload.reply_to = replyTo;
        }

        try {
            const { data, error } = await resend.emails.send(payload);
            if (error) {
                const errMsg = error.message || 'Resend request failed';
                console.error(`[EMAIL SERVICE: Resend ERROR] Delivery failed to ${recipients.join(', ')}:`, errMsg);
                throw new Error(`Resend API Error: ${errMsg}`);
            }

            console.log(`[EMAIL SERVICE: Resend] Email "${subject}" accepted for delivery to ${recipients.join(', ')}. ID: ${data?.id}`);
            return {
                success: true,
                provider: 'resend',
                status: 'Accepted',
                messageId: data?.id,
                recipients: recipients
            };
        } catch (resendErr) {
            console.error(`[EMAIL SERVICE: Resend Exception] ${resendErr.message}`);
            throw resendErr;
        }
    }

    // 2. Secondary Fallback: Nodemailer SMTP
    const transporter = getTransporter();
    if (transporter) {
        const fromAddress = from || resolveFromAddress('smtp');
        try {
            const info = await transporter.sendMail({
                from: fromAddress,
                to: recipients.length === 1 ? recipients[0] : recipients,
                subject: subject,
                text: plainText,
                html: html,
                replyTo: (replyTo && isValidEmail(replyTo)) ? replyTo : undefined
            });

            console.log(`[EMAIL SERVICE: SMTP] Email "${subject}" sent to ${recipients.join(', ')}. ID: ${info.messageId}`);
            return {
                success: true,
                provider: 'smtp',
                status: 'Sent',
                messageId: info.messageId,
                recipients: recipients
            };
        } catch (smtpErr) {
            console.error(`[EMAIL SERVICE: SMTP ERROR] Failed delivering to ${recipients.join(', ')}:`, smtpErr.message);
            throw smtpErr;
        }
    }

    // 3. Neither configured
    console.warn(`[EMAIL SERVICE] No email provider configured. Email "${subject}" to ${recipients.join(', ')} was not transmitted.`);
    throw new Error('Email service is not configured. Please set RESEND_API_KEY in environment configuration.');
}

/**
 * Send an official Account Verification / Activation email to a user.
 */
async function sendAccountVerificationEmail({ to, fullName, username, roleName = 'Church Member', activationLink = null }) {
    if (!to) {
        throw new Error('Recipient email address is required.');
    }

    const portalUrl = process.env.PORTAL_URL || 'http://localhost:5000';
    const loginUrl = `${portalUrl}/views/login.html`;
    const actionUrl = activationLink || loginUrl;
    const isActivation = Boolean(activationLink);

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
                                Welcome, ${escapeHtmlEmail(fullName) || 'Valued Member'}!
                            </h2>
                            <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #334155;">
                                ${isActivation 
                                    ? 'Your account on the Church of God World Missions Philippines - Imus Web Portal has been created. To activate your access, please verify your email address by clicking the activation button below.'
                                    : 'Your account has been officially verified by the church administration. You now have full access to member events, prayer requests, and church resources.'}
                            </p>

                            <!-- Account Details Table -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 24px 0;">
                                <tr>
                                    <td style="padding: 14px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px;">
                                        <strong style="color: #334155; width: 120px; display: inline-block;">Username:</strong>
                                        <code style="background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #0f172a;">${escapeHtmlEmail(username)}</code>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 14px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px;">
                                        <strong style="color: #334155; width: 120px; display: inline-block;">Email:</strong>
                                        <span style="color: #0f172a;">${escapeHtmlEmail(to)}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 14px 20px; border-bottom: 1px solid #f1f5f9; font-size: 14px;">
                                        <strong style="color: #334155; width: 120px; display: inline-block;">Portal Role:</strong>
                                        <span style="background-color: #dbeafe; color: #1e40af; font-weight: 600; font-size: 12px; padding: 3px 8px; border-radius: 10px;">${escapeHtmlEmail(roleName)}</span>
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

                            <!-- Action Button -->
                            <div style="text-align: center; margin: 32px 0 28px;">
                                <a href="${actionUrl}" style="background-color: ${isActivation ? '#059669' : '#0b1d3a'}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; letter-spacing: 0.3px;">
                                    ${isActivation ? 'Verify & Activate Account' : 'Log In to Member Portal'}
                                </a>
                            </div>

                            <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 16px; text-align: center;">
                                ${isActivation ? '⚠️ This verification link is valid for 24 hours. If you did not create this account, please ignore this email.' : 'You can log in anytime to manage your church profile, view upcoming services, and connect with your ministry group.'}
                            </p>

                            <!-- Plain text fallback URL -->
                            <div style="background-color: #f8fafc; border-radius: 6px; padding: 10px 14px; font-size: 11px; color: #64748b; word-break: break-all;">
                                If the button above does not work, copy and paste this link into your browser:<br>
                                <a href="${actionUrl}" style="color: #2563eb; text-decoration: underline;">${actionUrl}</a>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #0b1d3a; color: #94a3b8; padding: 24px 30px; text-align: center; font-size: 12px; line-height: 1.6;">
                            <p style="margin: 0 0 6px; color: #cbd5e1; font-weight: 600;">Church of God World Missions Philippines - Imus</p>
                            <p style="margin: 0 0 6px;">Cavite, Philippines • Dedicated to Worship, Outreach, Relationship, and Discipleship</p>
                            <p style="margin: 0; font-size: 11px; color: #64748b;">This is an automated system email. Replies to this email address are not monitored.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();

    const textContent = `
Church of God World Missions Philippines - Imus
Church Portal Account ${isActivation ? 'Verification' : 'Confirmation'}

Welcome, ${fullName || 'Valued Member'}!

${isActivation 
    ? 'Your church portal account has been created. Please activate your account by visiting the link below (valid for 24 hours):' 
    : 'Your church portal account has been verified by the administration. You may now log in to the portal.'}

Account Details:
- Username: ${username}
- Email: ${to}
- Portal Role: ${roleName}
- Status: ${isActivation ? 'Pending Verification' : 'Active & Verified'}

${isActivation ? 'Click here to verify and activate your account (valid for 24 hours):' : 'You can log in to the portal at:'}
${actionUrl}

Blessings,
Church of God World Missions Philippines - Imus
    `.trim();

    const subject = isActivation
        ? 'Action Required: Verify & Activate Your Church of God Imus Account'
        : 'Account Verified - Church of God Imus Portal';

    const result = await sendEmail({
        to: to,
        subject: subject,
        html: htmlContent,
        text: textContent
    });

    return result;
}

/**
 * Send an official Church Announcement email broadcast to a church member.
 */
async function sendAnnouncementEmail({ to, recipientName, title, content, category = 'General', department = 'Church Administration', publishDate = new Date() }) {
    if (!to) {
        throw new Error('Recipient email address is required.');
    }

    const portalUrl = process.env.PORTAL_URL || 'http://localhost:5000';
    const dateFormatted = new Date(publishDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtmlEmail(title)} - COGWM Imus Announcement</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 40px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #0b1d3a 0%, #1e3a8a 100%); padding: 28px 30px; text-align: center;">
                            <div style="font-size: 28px; margin-bottom: 6px;">📢</div>
                            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">Official Church Announcement</h1>
                            <p style="color: #93c5fd; margin: 4px 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Church of God World Missions - Imus</p>
                        </td>
                    </tr>

                    <!-- Category & Date Badge -->
                    <tr>
                        <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 12px 30px;">
                            <table width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="left">
                                        <span style="background-color: #dbeafe; color: #1e40af; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 12px; text-transform: uppercase;">
                                            ${escapeHtmlEmail(category)}
                                        </span>
                                        <span style="color: #64748b; font-size: 13px; margin-left: 8px;">
                                            • ${escapeHtmlEmail(department)}
                                        </span>
                                    </td>
                                    <td align="right" style="color: #64748b; font-size: 12px;">
                                        📅 ${dateFormatted}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px 30px;">
                            <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #0b1d3a; line-height: 1.3;">
                                ${escapeHtmlEmail(title)}
                            </h2>
                            <p style="font-size: 14px; color: #64748b; margin: 0 0 20px;">
                                Dear ${escapeHtmlEmail(recipientName) || 'Church Member'},
                            </p>
                            <div style="font-size: 15px; line-height: 1.7; color: #334155; white-space: pre-wrap; background-color: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #1e3a8a;">
${escapeHtmlEmail(content)}
                            </div>

                            <div style="text-align: center; margin: 30px 0 10px;">
                                <a href="${portalUrl}" style="background-color: #0b1d3a; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
                                    View in Church Portal
                                </a>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #0b1d3a; color: #94a3b8; padding: 20px 30px; text-align: center; font-size: 11px;">
                            <p style="margin: 0 0 4px; color: #cbd5e1;">Church of God World Missions Philippines - Imus</p>
                            <p style="margin: 0;">You received this email because you are a registered member of the COGWM Imus Portal.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();

    const textContent = `
[Announcement] ${title}
Church of God World Missions Philippines - Imus
Category: ${category} | Department: ${department}
Date: ${dateFormatted}

Dear ${recipientName || 'Church Member'},

${content}

View online on the church portal: ${portalUrl}
    `.trim();

    try {
        const result = await sendEmail({
            to: to,
            subject: `[Announcement] ${title} - Church of God Imus`,
            html: htmlContent,
            text: textContent
        });
        return { success: true, messageId: result.messageId, provider: result.provider, status: result.status || 'Accepted' };
    } catch (err) {
        return { success: false, error: err.message, status: 'Failed' };
    }
}

/**
 * Dispatches a Contact Inquiry / Prayer Request email directly to the pastoral/admin recipient.
 */
async function sendContactPrayerEmail({ name, email, contact_number, subject, message }) {
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
            .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; background: ${badgeColor}; color: #ffffff; margin-bottom: 8px; letter-spacing: 0.5px; }
            .content { padding: 30px; }
            .field-group { margin-bottom: 18px; }
            .label { font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
            .value { font-size: 15px; color: #0f172a; line-height: 1.5; }
            .message-box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #c9a961; padding: 18px; border-radius: 6px; font-size: 14px; line-height: 1.6; color: #334155; margin-top: 20px; white-space: pre-wrap; }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 15px 30px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <span class="badge">${badgeLabel}</span>
                <h2 style="margin: 0; font-size: 20px; font-weight: 700;">Church of God World Missions - Imus</h2>
                <p style="margin: 5px 0 0; font-size: 13px; opacity: 0.85;">Website Portal Submission</p>
            </div>
            <div class="content">
                <div class="field-group">
                    <div class="label">From</div>
                    <div class="value"><strong>${escapeHtmlEmail(name)}</strong></div>
                </div>
                <div class="field-group">
                    <div class="label">Email Address</div>
                    <div class="value"><a href="mailto:${escapeHtmlEmail(email)}" style="color: #2563eb; text-decoration: none;">${escapeHtmlEmail(email)}</a></div>
                </div>
                ${contact_number ? `
                <div class="field-group">
                    <div class="label">Contact Number</div>
                    <div class="value">${escapeHtmlEmail(contact_number)}</div>
                </div>` : ''}
                <div class="field-group">
                    <div class="label">Subject</div>
                    <div class="value"><strong>${escapeHtmlEmail(subject || 'General Inquiry')}</strong></div>
                </div>
                <div class="field-group" style="margin-bottom: 0;">
                    <div class="label">Message / Prayer Details</div>
                    <div class="message-box">${escapeHtmlEmail(message)}</div>
                </div>
            </div>
            <div class="footer">
                This is an automated notification from the Church of God World Missions Philippines - Imus Web Portal.
            </div>
        </div>
    </body>
    </html>
    `;

    const textContent = `
[${badgeLabel}] From: ${name}
Email: ${email}
Phone: ${contact_number || 'N/A'}
Subject: ${subject || 'General Inquiry'}

Message:
${message}

---
Delivered by Church of God Imus Web Portal
    `.trim();

    try {
        const result = await sendEmail({
            to: recipient,
            subject: `[${badgeLabel}] ${subject || 'New Message'} - from ${name}`,
            html: htmlContent,
            text: textContent,
            replyTo: email
        });

        console.log(`[EMAIL SERVICE] Contact/Prayer request delivered to ${recipient}. Message ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId, provider: result.provider, status: result.status || 'Accepted' };
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
    getResendClient,
    getEmailProviderInfo,
    verifySmtp,
    verifyEmailService,
    sendEmail,
    sendAccountVerificationEmail,
    sendAnnouncementEmail,
    sendContactPrayerEmail,
    isValidEmail,
    escapeHtmlEmail
};
