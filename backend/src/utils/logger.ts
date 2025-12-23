import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    if (stack) {
        return `${timestamp} [${level}]: ${message}\n${stack}`;
    }
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
});

// Custom format for file/JSON output
const jsonFormat = printf(({ level, message, timestamp, ...meta }) => {
    return JSON.stringify({ timestamp, level, message, ...meta });
});

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true })
    ),
    defaultMeta: { service: 'diet-connect-api' },
    transports: [
        // Console transport with colors
        new winston.transports.Console({
            format: combine(
                colorize(),
                consoleFormat
            )
        })
    ]
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'error.log'),
        level: 'error',
        format: jsonFormat
    }));

    logger.add(new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'combined.log'),
        format: jsonFormat
    }));
}

export default logger;
