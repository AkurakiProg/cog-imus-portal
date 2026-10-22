const contactModel = require('../models/contactModel');
const userModel = require('../models/userModel');
const { successResponse, errorResponse } = require('../utils/responseFormatter');

exports.submitPublic = async (req, res) => {
    try {
        const name = req.body.name ? req.body.name.trim() : '';
        const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
        const contact_number = req.body.contact_number ? req.body.contact_number.trim() : null;
        const subject = req.body.subject ? req.body.subject.trim() : 'General Inquiry';
        const message = req.body.message ? req.body.message.trim() : '';

        if (!name || !email || !message) {
            return errorResponse(res, 'Name, email, and message are required fields.', 400);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return errorResponse(res, 'Please provide a valid email address.', 400);
        }

        const id = await contactModel.create({ name, email, contact_number, subject, message });

        // Dispatch live notification email if configured
        const { sendContactPrayerEmail } = require('../utils/emailService');
        const emailResult = await sendContactPrayerEmail({ name, email, contact_number, subject, message });

        let userMsg = 'Thank you for reaching out! Your message has been received by our ministry team.';
        if (emailResult.success) {
            userMsg = 'Thank you for reaching out! Your message or prayer request has been delivered to our church ministry team.';
        }

        return successResponse(res, { id, message_id: id, email_delivered: emailResult.success }, userMsg, 201);
    } catch (error) {
        console.error('Contact submit error:', error);
        return errorResponse(res, 'Failed to submit message. Please try again later.', 500);
    }
};

exports.getAll = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const [messages, total, unread] = await Promise.all([
            contactModel.getAll(limit, offset),
            contactModel.getCount(),
            contactModel.getUnreadCount()
        ]);

        return successResponse(res, { messages, total, unread, page, limit }, 'Inquiries retrieved');
    } catch (error) {
        console.error('Get contact messages error:', error);
        return errorResponse(res, 'Failed to retrieve messages.', 500);
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await contactModel.markAsRead(id);
        return successResponse(res, null, 'Message marked as read');
    } catch (error) {
        return errorResponse(res, 'Failed to update message.', 500);
    }
};

exports.delete = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await contactModel.delete(id);
        if (req.user) {
            await userModel.logAudit(req.user.id, 'DELETE', 'Contact', id, null, null, req.ip, req.headers['user-agent']);
        }
        return successResponse(res, null, 'Message deleted');
    } catch (error) {
        return errorResponse(res, 'Failed to delete message.', 500);
    }
};
