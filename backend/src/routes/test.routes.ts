/**
 * Test-only routes for development testing without Clerk
 * Only loaded when NODE_ENV !== 'production'
 */
import { Router } from 'express';
import prisma from '../utils/prisma';
import logger from '../utils/logger';

const testRouter = Router();

// Lazy imports to avoid loading test middleware in production
const { testAuthBypass } = require('../middleware/testAuth.middleware');

// Import controllers
const clientController = require('../controllers/client.controller');
const dietPlanController = require('../controllers/dietPlan.controller');
const mealController = require('../controllers/meal.controller');
const mealLogController = require('../controllers/mealLog.controller');
const weightLogController = require('../controllers/weightLog.controller');
const foodItemController = require('../controllers/foodItem.controller');
const validationController = require('../controllers/validation.controller');

// Setup test org and user
testRouter.post('/setup', async (req: any, res: any) => {
    try {
        let org = await prisma.organization.findFirst({
            where: { name: 'Test Organization' },
        });

        if (!org) {
            org = await prisma.organization.create({
                data: {
                    name: 'Test Organization',
                    email: 'test@test.com',
                    phone: '+919999999999',
                    city: 'Delhi',
                },
            });
        }

        let user = await prisma.user.findFirst({
            where: { email: 'testuser@test.com' },
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    clerkUserId: 'test-clerk-id-123',
                    email: 'testuser@test.com',
                    fullName: 'Test Dietitian',
                    role: 'admin',
                    orgId: org.id,
                },
            });
        }

        res.json({
            success: true,
            data: {
                organizationId: org.id,
                userId: user.id,
                message: 'Use X-Test-User-Id header with userId for authenticated requests',
            },
        });
    } catch (error) {
        logger.error('Test setup error', { error: error instanceof Error ? error.message : error });
        res.status(500).json({ success: false, error: 'Setup failed' });
    }
});

// Clients
testRouter.post('/clients', testAuthBypass, clientController.createClient);
testRouter.get('/clients', testAuthBypass, clientController.listClients);
testRouter.get('/clients/:id', testAuthBypass, clientController.getClient);
testRouter.patch('/clients/:id', testAuthBypass, clientController.updateClient);
testRouter.get('/clients/:id/progress', testAuthBypass, clientController.getClientProgress);
testRouter.post('/clients/:clientId/weight-logs', testAuthBypass, weightLogController.createWeightLog);
testRouter.get('/clients/:clientId/weight-logs', testAuthBypass, weightLogController.listWeightLogs);

// Diet Plans
testRouter.post('/diet-plans', testAuthBypass, dietPlanController.createDietPlan);
testRouter.get('/diet-plans', testAuthBypass, dietPlanController.listDietPlans);
testRouter.get('/diet-plans/:id', testAuthBypass, dietPlanController.getDietPlan);
testRouter.patch('/diet-plans/:id', testAuthBypass, dietPlanController.updateDietPlan);
testRouter.post('/diet-plans/:id/publish', testAuthBypass, dietPlanController.publishDietPlan);

// Meals
testRouter.post('/meals', testAuthBypass, mealController.addMealToPlan);
testRouter.patch('/meals/:id', testAuthBypass, mealController.updateMeal);
testRouter.delete('/meals/:id', testAuthBypass, mealController.deleteMeal);

// Meal Logs
testRouter.post('/meal-logs', testAuthBypass, mealLogController.createMealLog);
testRouter.get('/meal-logs', testAuthBypass, mealLogController.listMealLogs);
testRouter.get('/meal-logs/:id', testAuthBypass, mealLogController.getMealLog);
testRouter.patch('/meal-logs/:id', testAuthBypass, mealLogController.updateMealLog);
testRouter.patch('/meal-logs/:id/review', testAuthBypass, mealLogController.reviewMealLog);

// Photo uploads
const { uploadSinglePhoto } = require('../middleware/upload.middleware');
testRouter.post('/meal-logs/:id/photo', testAuthBypass, uploadSinglePhoto, mealLogController.uploadMealPhoto);
testRouter.post('/weight-logs/:id/photo', testAuthBypass, uploadSinglePhoto, weightLogController.uploadProgressPhoto);

// Weight Logs
testRouter.post('/weight-logs', testAuthBypass, weightLogController.createWeightLogGeneral);
testRouter.get('/weight-logs', testAuthBypass, weightLogController.listAllWeightLogs);

// Food Items
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
testRouter.post('/diet-validation/check', testAuthBypass, validationController.checkValidation);
testRouter.post('/diet-validation/batch', testAuthBypass, validationController.checkBatchValidation);
testRouter.post('/diet-validation/invalidate-cache', testAuthBypass, validationController.invalidateCache);

export default testRouter;
