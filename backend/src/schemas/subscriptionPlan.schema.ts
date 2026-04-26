import { z } from 'zod';

const recurrenceEnum = z.enum(['day', 'week', 'month', 'year']);

export const createSubscriptionPlanSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(80, 'Name too long'),
    recurrenceUnit: recurrenceEnum,
    intervalCount: z.number().int().positive().max(120).default(1),
    /**
     * Optional override; when omitted, durationDays is derived from
     * `recurrenceUnit × intervalCount` server-side.
     */
    durationDays: z.number().int().positive().max(3650).optional(),
    costInr: z.number().nonnegative().max(10_000_000),
    active: z.boolean().default(true),
});

export const updateSubscriptionPlanSchema = createSubscriptionPlanSchema
    .partial()
    .extend({
        active: z.boolean().optional(),
    });

export type CreateSubscriptionPlanInput = z.infer<typeof createSubscriptionPlanSchema>;
export type UpdateSubscriptionPlanInput = z.infer<typeof updateSubscriptionPlanSchema>;

const RECURRENCE_TO_DAYS: Record<z.infer<typeof recurrenceEnum>, number> = {
    day: 1,
    week: 7,
    month: 30,
    year: 365,
};

/**
 * Derive a sensible duration when admin doesn't override. Approximate but
 * predictable: month=30, year=365. Admin can always override per plan.
 */
export function deriveDurationDays(unit: z.infer<typeof recurrenceEnum>, count: number): number {
    return RECURRENCE_TO_DAYS[unit] * count;
}
