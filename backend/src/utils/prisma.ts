import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Walk a Prisma result tree and (1) convert every `Prisma.Decimal` instance to
 * a plain JS number, and (2) drop soft-deleted rows (`deletedAt != null`) from
 * any result array.
 *
 * (1) Decimal → number: Decimals serialize as strings over JSON, which silently
 * breaks any frontend code doing arithmetic or expecting `z.number()` — see the
 * targetProteinG/CarbsG/FatsG bug that motivated this. Trade-off: any caller
 * doing `decimal.plus(other)` style arithmetic on a READ value will break. We
 * rely instead on `new Prisma.Decimal(...)` on the WRITE side and
 * `Number()`/`scaleNutrition` helpers on the READ side, which handle both shapes.
 *
 * (2) Strip soft-deleted rows: the soft-delete extension below only adds
 * `deletedAt: null` to TOP-LEVEL where clauses — Prisma client extensions cannot
 * filter relation `include`s. So soft-deleted children (e.g. replaced meals and
 * their food items) leaked into nested reads and piled up on every plan edit.
 * Since nothing in the app ever intentionally fetches soft-deleted rows, we
 * enforce the "soft-deleted = invisible" invariant here, on the result, for
 * every read including nested includes. Only ARRAY elements are dropped — a
 * single nested object is never nulled, so `obj.relation.deletedAt` checks still
 * work. NOTE: a `select` that omits `deletedAt` can't be filtered here (the flag
 * isn't present); those few call sites use an explicit relation `where` instead.
 */
function sanitizeReadResult<T>(value: T): T {
    if (value === null || value === undefined) return value;

    if (Prisma.Decimal.isDecimal(value as unknown as object)) {
        return (value as unknown as Prisma.Decimal).toNumber() as unknown as T;
    }

    // Leave non-object primitives, Date, and Buffer untouched.
    if (typeof value !== 'object') return value;
    if (value instanceof Date) return value;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return value;

    if (Array.isArray(value)) {
        const out: unknown[] = [];
        for (let i = 0; i < value.length; i += 1) {
            const el = value[i] as unknown;
            // Drop soft-deleted rows that leaked through a relation include.
            if (
                el !== null &&
                typeof el === 'object' &&
                !Array.isArray(el) &&
                (el as { deletedAt?: unknown }).deletedAt != null
            ) {
                continue;
            }
            out.push(sanitizeReadResult(el));
        }
        return out as unknown as T;
    }

    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) {
            out[k] = sanitizeReadResult(src[k]);
        }
    }
    return out as unknown as T;
}

/**
 * Soft-delete vs isActive semantics:
 *
 * - `deletedAt != null` → Record is soft-deleted. This extension automatically
 *   adds `deletedAt: null` to all read queries and converts `delete()` to a
 *   soft-delete (sets `deletedAt`). Soft-deleted records are invisible everywhere.
 *
 * - `isActive = false` → Record is deactivated but NOT deleted. It remains visible
 *   to admin queries (e.g. listing inactive clients, paused plans). Services that
 *   need "only active" records should explicitly filter `isActive: true`.
 *
 * Models with both fields: Organization, User, Client, DietPlan.
 * All other soft-delete models use only `deletedAt`.
 */
const SOFT_DELETE_MODELS: Prisma.ModelName[] = [
    'Organization',
    'User',
    'Client',
    'DietPlan',
    'SessionNote',
    'Meal',
    'MealLog',
    'WeightLog',
    'BodyMeasurement',
    'FoodItem',
    'MealFoodItem',
    'Invoice',
];

function isSoftDeleteModel(model: string | undefined): boolean {
    return !!model && SOFT_DELETE_MODELS.includes(model as Prisma.ModelName);
}

/** Convert PascalCase model name to camelCase Prisma client property */
function modelToProperty(model: string): string {
    return model.charAt(0).toLowerCase() + model.slice(1);
}

function createExtendedClient() {
    const base = new PrismaClient({
        log: ['error', 'warn'],
        datasources: {
            db: {
                url: process.env.DATABASE_URL,
            },
        },
    });

    // ── Layer 1: soft-delete pre-/post-processing ────────────────────────────
    const withSoftDelete = base.$extends({
        query: {
            $allModels: {
                async findMany({ model, args, query }) {
                    if (isSoftDeleteModel(model) && !(args.where as any)?.deletedAt) {
                        args.where = { ...(args.where ?? {}), deletedAt: null } as any;
                    }
                    return query(args);
                },
                async findFirst({ model, args, query }) {
                    if (isSoftDeleteModel(model) && !(args.where as any)?.deletedAt) {
                        args.where = { ...(args.where ?? {}), deletedAt: null } as any;
                    }
                    return query(args);
                },
                async findFirstOrThrow({ model, args, query }) {
                    if (isSoftDeleteModel(model) && !(args.where as any)?.deletedAt) {
                        args.where = { ...(args.where ?? {}), deletedAt: null } as any;
                    }
                    return query(args);
                },
                async count({ model, args, query }) {
                    if (isSoftDeleteModel(model) && !(args.where as any)?.deletedAt) {
                        args.where = { ...(args.where ?? {}), deletedAt: null } as any;
                    }
                    return query(args);
                },
                async aggregate({ model, args, query }) {
                    if (isSoftDeleteModel(model) && !(args.where as any)?.deletedAt) {
                        args.where = { ...(args.where ?? {}), deletedAt: null } as any;
                    }
                    return query(args);
                },
                async groupBy({ model, args, query }) {
                    if (isSoftDeleteModel(model) && !(args.where as any)?.deletedAt) {
                        args.where = { ...(args.where ?? {}), deletedAt: null } as any;
                    }
                    return query(args);
                },
                async delete({ model, args, query }) {
                    if (isSoftDeleteModel(model)) {
                        // Convert hard delete to soft delete via base client
                        const prop = modelToProperty(model);
                        return (base as any)[prop].update({
                            where: args.where,
                            data: { deletedAt: new Date() },
                        });
                    }
                    return query(args);
                },
                async deleteMany({ model, args, query }) {
                    if (isSoftDeleteModel(model)) {
                        const prop = modelToProperty(model);
                        return (base as any)[prop].updateMany({
                            where: (args as any).where,
                            data: { deletedAt: new Date() },
                        });
                    }
                    return query(args);
                },
            },
        },
    });

    // ── Layer 2: sanitize every result ───────────────────────────────────────
    //   Wraps Layer 1 so the top-level soft-delete where-filtering runs first;
    //   then the raw result bubbles up here where we (a) unwrap Decimals to plain
    //   numbers and (b) drop soft-deleted rows that leaked through relation
    //   includes. Applies to all operations including $queryRaw, aggregate, etc.
    return withSoftDelete.$extends({
        query: {
            async $allOperations({ args, query }) {
                const result = await query(args);
                return sanitizeReadResult(result);
            },
        },
    });
}

type ExtendedPrismaClient = ReturnType<typeof createExtendedClient>;

const globalForPrisma = globalThis as unknown as {
    prisma: ExtendedPrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? createExtendedClient();

export default prisma;

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

// Graceful shutdown: disconnect Prisma on process termination
const shutdown = async () => {
    await (prisma as any).$disconnect();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
