const express = require('express');
const router = express.Router();
const realtimeBus = require('../utils/realtimeBus');

router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    // Initial connection acknowledgment
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

    const onEvent = (payload) => {
        try {
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
        } catch (e) {
            // Client socket closed
        }
    };

    realtimeBus.on('realtime_event', onEvent);

    // Keepalive ping every 25s
    const heartbeat = setInterval(() => {
        try {
            res.write(': keepalive\n\n');
        } catch (e) {
            clearInterval(heartbeat);
        }
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
        realtimeBus.removeListener('realtime_event', onEvent);
    });
});

module.exports = router;
