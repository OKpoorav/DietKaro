import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { clerkMiddleware } from '@clerk/express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import logger from './utils/logger';

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Clerk middleware - adds auth info to every request
app.use(clerkMiddleware());

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
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
import shareRoutes from './routes/share.routes';
import adminReferralRoutes from './routes/adminReferral.routes';
import validationRoutes from './routes/validation.routes';
import onboardingRoutes from './routes/onboarding.routes';
import notificationRoutes from './routes/notification.routes';

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/clients/:clientId/onboarding', onboardingRoutes); // Client onboarding
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
app.use('/media', mediaRoutes); // Public media proxy (no auth required)

// Client Mobile App Routes
app.use('/api/v1/client-auth', clientAuthRoutes);
app.use('/api/v1/client', clientApiRoutes);
app.use('/api/v1/client/referral', referralRoutes);
app.use('/api/v1/client/reports', reportsRoutes);



// Test-only routes (for development testing without Clerk)
if (process.env.NODE_ENV !== 'production') {
    const testRouter = require('./routes/test.routes').default;
    app.use('/test', testRouter);
}

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

export default app;
