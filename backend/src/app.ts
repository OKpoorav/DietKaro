import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Prisma } from '@prisma/client';
import { clerkMiddleware } from '@clerk/express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { apiLimiter } from './middleware/rateLimiter';
import logger from './utils/logger';
import prisma from './utils/prisma';
import redis from './utils/redis';
import { env } from './config/env';

const app = express();

// Trust reverse proxy (nginx, load balancer) — required for rate limiter, req.ip, secure cookies
if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Request ID — first middleware, before everything else
app.use(requestIdMiddleware);

// CORS Configuration
const ALLOWED_ORIGINS = (env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

if (ALLOWED_ORIGINS.length === 0 && env.NODE_ENV !== 'production') {
    ALLOWED_ORIGINS.push(
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8081',
    );
    logger.warn('CORS: No CORS_ALLOWED_ORIGINS set, using development defaults');
}

if (ALLOWED_ORIGINS.length === 0 && env.NODE_ENV === 'production') {
    logger.error('CORS: CORS_ALLOWED_ORIGINS is not set in production! All cross-origin requests will be blocked.');
}

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) {
            return callback(null, true);
        }
        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        logger.warn(`CORS: Blocked request from origin: ${origin}`);
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400,
};

// Middleware
// `verify` captures the raw request body for webhook signature verification.
// Razorpay (and similar providers) require the byte-exact body to compute HMAC.
app.use(express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
        if (req.url && req.url.startsWith('/api/v1/webhooks/')) {
            (req as unknown as { rawBody?: string }).rawBody = buf.toString('utf8');
        }
    },
}));
app.use(cors(corsOptions));
app.use(helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false, // CSP in prod only
    crossOriginEmbedderPolicy: false, // Allow loading images from S3/CDN
    hsts: env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

// Logging — structured JSON in production, readable format in dev
if (env.NODE_ENV === 'production') {
    app.use(morgan('combined', {
        stream: { write: (msg: string) => logger.info(msg.trim()) },
        skip: (req) => req.path === '/health' || req.path === '/readiness',
    }));
} else {
    app.use(morgan('dev'));
}

// Global rate limiting on all /api routes
app.use('/api/', apiLimiter);

// Clerk middleware — applied to all routes EXCEPT mobile client routes.
// /api/v1/client  → mobile app (backend JWT, never calls getAuth)
// /api/v1/client-auth → mobile auth (backend JWT, never calls getAuth)
// /api/v1/clients → dietitian client management (needs Clerk)
// Using a wrapper instead of regex because app.use(regex) is unreliable in Express 4.
app.use((req, res, next) => {
    const p = req.path;
    const isMobileRoute = p.startsWith('/api/v1/client') && !p.startsWith('/api/v1/clients');
    if (isMobileRoute) return next();
    return clerkMiddleware({ clockSkewInMs: 10_000 })(req, res, next);
});

// Health check (liveness)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness check (deep health)
app.get('/readiness', async (req, res) => {
    let db = false;
    let redisOk = false;

    try {
        await prisma.$queryRaw(Prisma.sql`SELECT 1`);
        db = true;
    } catch (err) {
        logger.error('Readiness: DB ping failed', { error: (err as Error).message });
    }

    try {
        await redis.ping();
        redisOk = true;
    } catch (err) {
        logger.error('Readiness: Redis ping failed', { error: (err as Error).message });
    }

    const ok = db && redisOk;
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'error', db, redis: redisOk });
});

import authRoutes from './routes/auth.routes';

import organizationRoutes from './routes/organization.routes';
import clientRoutes from './routes/client.routes';
import dietPlanRoutes from './routes/dietPlan.routes';
import mealRoutes from './routes/meal.routes';
import mealLogRoutes from './routes/mealLog.routes';
import weightLogRoutes from './routes/weightLog.routes';
import foodItemRoutes from './routes/foodItem.routes';
import mediaRoutes from './routes/media.routes';
import dashboardRoutes from './routes/dashboard.routes';
import teamRoutes from './routes/team.routes';
import clientAuthRoutes from './routes/clientAuth.routes';
import clientApiRoutes from './routes/clientApi.routes';
import referralRoutes from './routes/referral.routes';
import reportsRoutes from './routes/reports.routes';
import tagsRoutes from './routes/tags.routes';
import subscriptionPlanRoutes from './routes/subscriptionPlan.routes';
import subscriptionListRoutes from './routes/subscription.routes';
import clientSubscriptionRoutes from './routes/clientSubscription.routes';
import clientPaymentRoutes from './routes/clientPayment.routes';
import webhookRoutes from './routes/webhook.routes';
import clientSubscriptionApiRoutes from './routes/clientSubscriptionApi.routes';
import shareRoutes from './routes/share.routes';
import adminReferralRoutes from './routes/adminReferral.routes';
import validationRoutes from './routes/validation.routes';
import onboardingRoutes from './routes/onboarding.routes';
import notificationRoutes from './routes/notification.routes';
import complianceRoutes from './routes/compliance.routes';
import invoiceRoutes from './routes/invoice.routes';
import chatRoutes from './routes/chat.routes';
import reportSummaryRoutes from './routes/report-summary.routes';
import clientDocumentSummaryRoutes from './routes/client-document-summary.routes';

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/clients/:clientId/onboarding', onboardingRoutes); // Client onboarding
app.use('/api/v1/clients/:clientId/adherence', complianceRoutes); // Compliance & adherence
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/diet-plans', dietPlanRoutes);
app.use('/api/v1/meals', mealRoutes);
app.use('/api/v1/meal-logs', mealLogRoutes);
app.use('/api/v1/weight-logs', weightLogRoutes);
app.use('/api/v1/food-items', foodItemRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/team', teamRoutes);
app.use('/api/v1/share', shareRoutes); // Diet plan sharing (PDF, email, etc)
app.use('/api/v1/referrals', adminReferralRoutes); // Admin referral management
app.use('/api/v1/diet-validation', validationRoutes); // Real-time diet validation
app.use('/api/v1/invoices', invoiceRoutes); // Invoice management
app.use('/api/v1/chat', chatRoutes); // Dietitian chat
app.use('/api/v1/reports', reportSummaryRoutes); // Per-document AI summaries (dietitian)
app.use('/api/v1/tags', tagsRoutes); // Org-wide client smart tags (admin write, all read)
app.use('/api/v1/plans', subscriptionPlanRoutes); // Subscription plan master (admin CRUD)
app.use('/api/v1/subscriptions', subscriptionListRoutes); // Aggregate listing for Subscriptions tab
app.use('/api/v1/clients/:clientId/subscription', clientSubscriptionRoutes); // Per-client subscription lifecycle
app.use('/api/v1/clients/:clientId/payments', clientPaymentRoutes); // Per-client payment ops (manual + Razorpay link)
app.use('/api/v1/webhooks', webhookRoutes); // External webhooks (Razorpay) — signature-verified
app.use('/api/v1/clients/:clientId/document-summary', clientDocumentSummaryRoutes); // Unified client summary
app.use('/media', mediaRoutes); // Public media proxy (no auth required)

// Client Mobile App Routes
app.use('/api/v1/client-auth', clientAuthRoutes);
app.use('/api/v1/client', clientApiRoutes);
app.use('/api/v1/client/referral', referralRoutes);
app.use('/api/v1/client/reports', reportsRoutes);
app.use('/api/v1/client/subscription', clientSubscriptionApiRoutes);



// Test-only routes (for development testing without Clerk)
// SECURITY: Double-guard — must be 'test' env AND explicitly opted-in via ENABLE_TEST_ROUTES
if (env.NODE_ENV === 'test' && process.env.ENABLE_TEST_ROUTES === 'true') {
    const testRouter = require('./routes/test.routes').default;
    app.use('/test', testRouter);
    logger.warn('⚠ Test routes are ENABLED — do NOT use in production');
}

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

export default app;
