import { describe, it, expect } from 'vitest';
import { safeSortBy, buildPaginationParams, buildDateFilter } from '../src/utils/queryFilters';

describe('safeSortBy', () => {
    const allowed = new Set(['createdAt', 'name', 'email']);

    it('returns field when it is in allowed set', () => {
        expect(safeSortBy('name', allowed, 'createdAt')).toBe('name');
    });

    it('returns default when field is not allowed', () => {
        expect(safeSortBy('password', allowed, 'createdAt')).toBe('createdAt');
    });

    it('returns default when sortBy is undefined', () => {
        expect(safeSortBy(undefined, allowed, 'createdAt')).toBe('createdAt');
    });

    it('returns default when sortBy is empty string', () => {
        expect(safeSortBy('', allowed, 'createdAt')).toBe('createdAt');
    });

    it('prevents SQL-like injection strings', () => {
        expect(safeSortBy('name; DROP TABLE users', allowed, 'createdAt')).toBe('createdAt');
    });
});

describe('buildPaginationParams', () => {
    it('returns defaults for undefined inputs', () => {
        const result = buildPaginationParams(undefined, undefined);
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(20);
        expect(result.skip).toBe(0);
    });

    it('calculates skip correctly', () => {
        const result = buildPaginationParams(3, 10);
        expect(result.skip).toBe(20);
        expect(result.take).toBe(10);
    });

    it('clamps page to minimum 1', () => {
        const result = buildPaginationParams(-5, 10);
        expect(result.page).toBe(1);
    });
});

describe('buildDateFilter', () => {
    it('returns undefined when no dates provided', () => {
        expect(buildDateFilter()).toBeUndefined();
    });

    it('creates gte filter for dateFrom only', () => {
        const result = buildDateFilter('2024-01-01');
        expect(result).toHaveProperty('gte');
        expect(result).not.toHaveProperty('lte');
    });

    it('creates both gte and lte for date range', () => {
        const result = buildDateFilter('2024-01-01', '2024-12-31');
        expect(result).toHaveProperty('gte');
        expect(result).toHaveProperty('lte');
    });
});
