import { Prisma } from '@prisma/client';

/**
 * Convert a Prisma Decimal (or null/undefined) to a plain number (or null).
 * Safe to call on values that are already numbers.
 */
export function toNumber(value: Prisma.Decimal | number | null | undefined): number | null {
    if (value == null) return null;
    return typeof value === 'number' ? value : value.toNumber();
}
