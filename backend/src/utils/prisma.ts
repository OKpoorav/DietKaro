import { PrismaClient, Prisma } from '@prisma/client';

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
