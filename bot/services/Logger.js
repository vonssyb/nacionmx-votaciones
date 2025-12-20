const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

// Define format
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `${info.timestamp} [${info.level}]: ${info.message}`
    )
);

// Define transports
const transports = [
    // Console transport
    new winston.transports.Console({
        format: format,
    }),

    // Error logs - rotate daily, keep 30 days
    new DailyRotateFile({
        filename: path.join(__dirname, '../logs/error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxFiles: '30d',
        maxSize: '20m',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        )
    }),

    // Combined logs - rotate daily, keep 14 days
    new DailyRotateFile({
        filename: path.join(__dirname, '../logs/combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d',
        maxSize: '20m',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        )
    }),

    // Performance logs - track slow operations
    new DailyRotateFile({
        filename: path.join(__dirname, '../logs/performance-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'http',
        maxFiles: '7d',
        maxSize: '10m',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        )
    })
];

// Create logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels,
    transports,
    exceptionHandlers: [
        new DailyRotateFile({
            filename: path.join(__dirname, '../logs/exceptions-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxFiles: '30d',
        })
    ],
    rejectionHandlers: [
        new DailyRotateFile({
            filename: path.join(__dirname, '../logs/rejections-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxFiles: '30d',
        })
    ]
});

// Performance tracking helper
logger.trackPerformance = (operation, duration, metadata = {}) => {
    logger.http(`Performance: ${operation} took ${duration}ms`, {
        operation,
        duration,
        ...metadata
    });

    // Warn if slow
    if (duration > 1000) {
        logger.warn(`Slow operation detected: ${operation} (${duration}ms)`);
    }
};

// Transaction logging helper
logger.transaction = (type, amount, userId, metadata = {}) => {
    logger.info(`Transaction: ${type} - $${amount} - User:${userId}`, {
        type: 'transaction',
        transactionType: type,
        amount,
        userId,
        ...metadata
    });
};

// Error with context helper
logger.errorWithContext = (message, error, context = {}) => {
    logger.error(message, {
        error: {
            message: error.message,
            stack: error.stack,
            name: error.name
        },
        ...context
    });
};

module.exports = logger;
