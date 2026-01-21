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
    const testRouter = express.Router();
    const { testAuthBypass } = require('./middleware/testAuth.middleware');
    const prisma = require('./utils/prisma').default;

    // Import controllers directly for testing
    const clientController = require('./controllers/client.controller');
    const dietPlanController = require('./controllers/dietPlan.controller');
    const mealController = require('./controllers/meal.controller');
    const mealLogController = require('./controllers/mealLog.controller');
    const weightLogController = require('./controllers/weightLog.controller');

    // Create test user and org for testing
    testRouter.post('/setup', async (req: any, res: any) => {
        try {
            let org = await prisma.organization.findFirst({
                where: { name: 'Test Organization' }
            });

            if (!org) {
                org = await prisma.organization.create({
                    data: {
                        name: 'Test Organization',
                        email: 'test@test.com',
                        phone: '+919999999999',
                        city: 'Delhi'
                    }
                });
            }

            let user = await prisma.user.findFirst({
                where: { email: 'testuser@test.com' }
            });

            if (!user) {
                user = await prisma.user.create({
                    data: {
                        clerkUserId: 'test-clerk-id-123',
                        email: 'testuser@test.com',
                        fullName: 'Test Dietitian',
                        role: 'admin',
                        orgId: org.id
                    }
                });
            }

            res.json({
                success: true,
                data: {
                    organizationId: org.id,
                    userId: user.id,
                    message: 'Use X-Test-User-Id header with userId for authenticated requests'
                }
            });
        } catch (error) {
            console.error('Test setup error:', error);
            res.status(500).json({ success: false, error: 'Setup failed' });
        }
    });

    // Direct test routes - bypass auth middleware
    testRouter.post('/clients', testAuthBypass, clientController.createClient);
    testRouter.get('/clients', testAuthBypass, clientController.listClients);
    testRouter.get('/clients/:id', testAuthBypass, clientController.getClient);
    testRouter.patch('/clients/:id', testAuthBypass, clientController.updateClient);
    testRouter.get('/clients/:id/progress', testAuthBypass, clientController.getClientProgress);
    testRouter.post('/clients/:clientId/weight-logs', testAuthBypass, weightLogController.createWeightLog);
    testRouter.get('/clients/:clientId/weight-logs', testAuthBypass, weightLogController.listWeightLogs);

    testRouter.post('/diet-plans', testAuthBypass, dietPlanController.createDietPlan);
    testRouter.get('/diet-plans', testAuthBypass, dietPlanController.listDietPlans);
    testRouter.get('/diet-plans/:id', testAuthBypass, dietPlanController.getDietPlan);
    testRouter.patch('/diet-plans/:id', testAuthBypass, dietPlanController.updateDietPlan);
    testRouter.post('/diet-plans/:id/publish', testAuthBypass, dietPlanController.publishDietPlan);

    testRouter.post('/meals', testAuthBypass, mealController.addMealToPlan);
    testRouter.patch('/meals/:id', testAuthBypass, mealController.updateMeal);
    testRouter.delete('/meals/:id', testAuthBypass, mealController.deleteMeal);

    testRouter.post('/meal-logs', testAuthBypass, mealLogController.createMealLog);
    testRouter.get('/meal-logs', testAuthBypass, mealLogController.listMealLogs);
    testRouter.get('/meal-logs/:id', testAuthBypass, mealLogController.getMealLog);
    testRouter.patch('/meal-logs/:id', testAuthBypass, mealLogController.updateMealLog);
    testRouter.patch('/meal-logs/:id/review', testAuthBypass, mealLogController.reviewMealLog);

    // Photo upload routes (need multer middleware)
    const { uploadSinglePhoto } = require('./middleware/upload.middleware');
    testRouter.post('/meal-logs/:id/photo', testAuthBypass, uploadSinglePhoto, mealLogController.uploadMealPhoto);
    testRouter.post('/weight-logs/:id/photo', testAuthBypass, uploadSinglePhoto, weightLogController.uploadProgressPhoto);

    testRouter.post('/weight-logs', testAuthBypass, weightLogController.createWeightLogGeneral);
    testRouter.get('/weight-logs', testAuthBypass, weightLogController.listAllWeightLogs);

    // Food Items
    const foodItemController = require('./controllers/foodItem.controller');
    testRouter.post('/food-items', testAuthBypass, foodItemController.createFoodItem);
    testRouter.get('/food-items', testAuthBypass, foodItemController.listFoodItems);
    testRouter.get('/food-items/:id', testAuthBypass, foodItemController.getFoodItem);
    testRouter.patch('/food-items/:id', testAuthBypass, foodItemController.updateFoodItem);
    testRouter.delete('/food-items/:id', testAuthBypass, foodItemController.deleteFoodItem);

    // Meal Food Items
    testRouter.post('/meals/:mealId/food-items', testAuthBypass, foodItemController.addFoodToMeal);
    testRouter.patch('/meals/:mealId/food-items/:itemId', testAuthBypass, foodItemController.updateMealFoodItem);
    testRouter.delete('/meals/:mealId/food-items/:itemId', testAuthBypass, foodItemController.removeFoodFromMeal);

    // Diet Validation
    const validationController = require('./controllers/validation.controller');
    testRouter.post('/diet-validation/check', testAuthBypass, validationController.checkValidation);
    testRouter.post('/diet-validation/batch', testAuthBypass, validationController.checkBatchValidation);
    testRouter.post('/diet-validation/invalidate-cache', testAuthBypass, validationController.invalidateCache);

    app.use('/test', testRouter);
}

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

export default app;
