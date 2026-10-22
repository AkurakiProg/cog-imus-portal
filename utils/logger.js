const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

function formatTimestamp() {
    return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function writeLog(level, message) {
    const logLine = `[${formatTimestamp()}] [${level.toUpperCase()}] ${message}\n`;
    const dateStr = new Date().toISOString().split('T')[0];
    const logFile = path.join(LOG_DIR, `${dateStr}.log`);
    fs.appendFile(logFile, logLine, (err) => {
        if (err) console.error('Failed to write log file:', err);
    });
}

const logger = {
    info: (message) => {
        console.log(`\x1b[36m[INFO]\x1b[0m ${message}`);
        writeLog('info', message);
    },
    warn: (message) => {
        console.warn(`\x1b[33m[WARN]\x1b[0m ${message}`);
        writeLog('warn', message);
    },
    error: (message) => {
        console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`);
        writeLog('error', message);
    },
    debug: (message) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`\x1b[35m[DEBUG]\x1b[0m ${message}`);
            writeLog('debug', message);
        }
    }
};

module.exports = logger;