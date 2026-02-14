import { PrismaClient, Prisma } from '@prisma/client';

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

    return base.$extends({
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
