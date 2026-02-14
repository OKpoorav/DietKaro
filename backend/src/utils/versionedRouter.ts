import { Router } from 'express';

/**
 * Create a versioned API router. Injects the API version into each request
 * for downstream middleware/logging.
 *
 * Usage:
 *   const v1 = createVersionRouter('v1');
 *   v1.use('/auth', authRoutes);
 *   app.use('/api/v1', v1);
 *
 *   // When v2 is needed:
 *   const v2 = createVersionRouter('v2');
 *   v2.use('/auth', authRoutesV2);
 *   app.use('/api/v2', v2);
 */
export function createVersionRouter(version: string): Router {
    const router = Router({ mergeParams: true });

    router.use((req, _res, next) => {
        (req as any).apiVersion = version;
        next();
    });

    return router;
}
