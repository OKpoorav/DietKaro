import rateLimit from 'express-rate-limit';

export const otpRequestLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 3,
    keyGenerator: (req) => req.body.phone || req.ip || 'unknown',
    validate: { keyGeneratorIpFallback: false },
    message: {
        success: false,
        error: {
            code: 'RATE_LIMITED',
            message: 'Too many OTP requests. Please try again in 5 minutes.',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const otpVerifyLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.body.phone || req.ip || 'unknown',
    validate: { keyGeneratorIpFallback: false },
    message: {
        success: false,
        error: {
            code: 'RATE_LIMITED',
            message: 'Too many verification attempts. Please request a new OTP.',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests.' },
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const writeOperationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many write requests. Please slow down.' },
    },
    standardHeaders: true,
    legacyHeaders: false,
});
