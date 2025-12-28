const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    transports: [
        // Error logs - separate file for errors only
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // All logs
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Log to console in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Log uncaught exceptions
logger.exceptions.handle(
    new winston.transports.File({
        filename: path.join(logsDir, 'exceptions.log'),
        maxsize: 5242880,
        maxFiles: 3
    })
);

module.exports = logger;
