import { describe, it, expect } from 'vitest';
import { otpRequestLimiter, otpVerifyLimiter, apiLimiter, writeOperationLimiter } from '../src/middleware/rateLimiter';

describe('Rate limiters', () => {
    it('exports otpRequestLimiter', () => {
        expect(otpRequestLimiter).toBeDefined();
        expect(typeof otpRequestLimiter).toBe('function');
    });

    it('exports otpVerifyLimiter', () => {
        expect(otpVerifyLimiter).toBeDefined();
        expect(typeof otpVerifyLimiter).toBe('function');
    });

    it('exports apiLimiter', () => {
        expect(apiLimiter).toBeDefined();
        expect(typeof apiLimiter).toBe('function');
    });

    it('exports writeOperationLimiter', () => {
        expect(writeOperationLimiter).toBeDefined();
        expect(typeof writeOperationLimiter).toBe('function');
    });
});
