/**
 * Validation Engine Tests
 * Tests for the diet validation engine
 * 
 * Run with: npx tsx tests/validationEngine.test.ts
 */

import { ValidationEngine } from '../src/services/validationEngine.service';
import { ValidationSeverity, ClientTags, FoodTags, FoodRestriction, PlanTargets, ValidationAlert } from '../src/types/validation.types';

// ============ TEST DATA ============

const createClientTags = (overrides: Partial<ClientTags> = {}): ClientTags => ({
    allergies: new Set(),
    intolerances: new Set(),
    dietPattern: null,
    eggAllowed: true,
    eggAvoidDays: new Set(),
    foodRestrictions: [],
    dislikes: new Set(),
    avoidCategories: new Set(),
    medicalConditions: new Set(),
    labDerivedTags: new Set(),
    likedFoods: new Set(),
    preferredCuisines: new Set(),
    ...overrides
});

const createFoodTags = (name: string, overrides: Partial<FoodTags> = {}): FoodTags => ({
    id: `food_${name.toLowerCase().replace(/\s+/g, '_')}`,
    name,
    allergenFlags: new Set(),
    dietaryCategory: null,
    nutritionTags: new Set(),
    healthFlags: new Set(),
    cuisineTags: new Set(),
    processingLevel: null,
    mealSuitabilityTags: new Set(),
    ...overrides
});

// ============ MOCK VALIDATION ENGINE ============

// Create a testable version that doesn't hit DB
class TestableValidationEngine extends ValidationEngine {
    private testClientTags: ClientTags | null = null;
    private testFoodTags: FoodTags | null = null;
    private testPlanTargets: PlanTargets | null = null;
    private testRepetitionCount: number = 0;

    setTestClientTags(tags: ClientTags) {
        this.testClientTags = tags;
    }

    setTestFoodTags(tags: FoodTags) {
        this.testFoodTags = tags;
    }

    setTestPlanTargets(targets: PlanTargets) {
        this.testPlanTargets = targets;
    }

    setTestRepetitionCount(count: number) {
        this.testRepetitionCount = count;
    }

    // Override to use test data instead of DB
    protected async getClientTags(clientId: string): Promise<ClientTags | null> {
        return this.testClientTags;
    }

    protected async getFoodTags(foodId: string): Promise<FoodTags | null> {
        return this.testFoodTags;
    }

    protected async getPlanTargets(planId: string): Promise<PlanTargets | null> {
        return this.testPlanTargets;
    }

    protected async getPlanFoodCounts(planId: string): Promise<Map<string, number>> {
        const counts = new Map<string, number>();
        if (this.testFoodTags && this.testRepetitionCount > 0) {
            counts.set(this.testFoodTags.id, this.testRepetitionCount);
        }
        return counts;
    }

    protected async checkRepetition(foodId: string, planId: string): Promise<ValidationAlert | null> {
        if (this.testRepetitionCount >= 3) {
            return {
                type: 'repetition',
                severity: ValidationSeverity.YELLOW,
                message: `🟡 REPETITION: This food appears ${this.testRepetitionCount} times this week. Consider variety.`,
                recommendation: 'Try different foods for nutritional variety',
                icon: 'repeat'
            };
        }
        return null;
    }
}

// ============ TESTS ============

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
    try {
        await fn();
        console.log(`✅ PASS: ${name}`);
        passed++;
    } catch (error) {
        console.log(`❌ FAIL: ${name}`);
        console.log(`   Error: ${error instanceof Error ? error.message : error}`);
        failed++;
    }
}

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

// ============ RUN TESTS ============

async function runTests() {
    console.log('\n🧪 Running Validation Engine Tests\n');
    console.log('='.repeat(50));

    // Test 1: Allergy Blocking (RED)
    await test('Allergy to peanuts blocks peanut food', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({
            allergies: new Set(['peanuts'])
        }));

        engine.setTestFoodTags(createFoodTags('Peanut Butter', {
            allergenFlags: new Set(['peanuts'])
        }));

        const result = await engine.validate('client1', 'food1', {
            currentDay: 'monday',
            mealType: 'breakfast'
        });

        assertEqual(result.severity, ValidationSeverity.RED, 'Should be RED severity');
        assertEqual(result.canAdd, false, 'Should not allow adding');
        assert(result.alerts.length > 0, 'Should have alerts');
        assertEqual(result.alerts[0].type, 'allergy', 'Should be allergy alert');
    });

    // Test 2: Intolerance Blocking (RED)
    await test('Lactose intolerance blocks dairy food', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({
            intolerances: new Set(['lactose'])
        }));

        engine.setTestFoodTags(createFoodTags('Milk', {
            allergenFlags: new Set(['lactose', 'milk'])
        }));

        const result = await engine.validate('client1', 'food1', {
            currentDay: 'monday',
            mealType: 'breakfast'
        });

        assertEqual(result.severity, ValidationSeverity.RED, 'Should be RED severity');
        assertEqual(result.canAdd, false, 'Should not allow adding');
        assertEqual(result.alerts[0].type, 'intolerance', 'Should be intolerance alert');
    });

    // Test 3: Diet Pattern - Vegetarian blocking non-veg (RED)
    await test('Vegetarian client cannot eat non-veg food', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({
            dietPattern: 'vegetarian'
        }));

        engine.setTestFoodTags(createFoodTags('Chicken Curry', {
            dietaryCategory: 'non_veg'
        }));

        const result = await engine.validate('client1', 'food1', {
            currentDay: 'monday',
            mealType: 'lunch'
        });

        assertEqual(result.severity, ValidationSeverity.RED, 'Should be RED severity');
        assertEqual(result.canAdd, false, 'Should not allow adding');
        assertEqual(result.alerts[0].type, 'diet_pattern', 'Should be diet_pattern alert');
    });

    // Test 4: Day Restriction - Egg on Tuesday (RED)
    await test('Egg avoid days blocks eggs on specific day', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({
            eggAvoidDays: new Set(['tuesday', 'thursday'])
        }));

        engine.setTestFoodTags(createFoodTags('Egg Omelette', {
            allergenFlags: new Set(['eggs'])
        }));

        // Test on Tuesday - should block
        const resultTuesday = await engine.validate('client1', 'food1', {
            currentDay: 'tuesday',
            mealType: 'breakfast'
        });

        assertEqual(resultTuesday.severity, ValidationSeverity.RED, 'Should be RED on Tuesday');
        assertEqual(resultTuesday.canAdd, false, 'Should not allow adding on Tuesday');
    });

    // Test 5: Day Restriction - Egg on Saturday (ALLOWED)
    await test('Egg avoid days allows eggs on other days', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({
            eggAvoidDays: new Set(['tuesday', 'thursday'])
        }));

        engine.setTestFoodTags(createFoodTags('Egg Omelette', {
            allergenFlags: new Set(['eggs'])
        }));

        // Test on Saturday - should allow
        const resultSaturday = await engine.validate('client1', 'food1', {
            currentDay: 'saturday',
            mealType: 'breakfast'
        });

        assertEqual(resultSaturday.canAdd, true, 'Should allow adding on Saturday');
        assert(resultSaturday.severity !== ValidationSeverity.RED, 'Should not be RED on Saturday');
    });

    // Test 6: Medical Condition Warning (YELLOW)
    await test('Pre-diabetes warns about high sugar food', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({
            medicalConditions: new Set(['pre_diabetes'])
        }));

        engine.setTestFoodTags(createFoodTags('Chocolate Cake', {
            nutritionTags: new Set(['high_sugar', 'high_calorie'])
        }));

        const result = await engine.validate('client1', 'food1', {
            currentDay: 'monday',
            mealType: 'snack'
        });

        assertEqual(result.severity, ValidationSeverity.YELLOW, 'Should be YELLOW severity');
        assertEqual(result.canAdd, true, 'Should allow adding with warning');
        assert(result.alerts.some(a => a.type === 'medical'), 'Should have medical alert');
    });

    // Test 7: Lab-derived Warning (YELLOW)
    await test('High cholesterol warns about cholesterol food', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({
            labDerivedTags: new Set(['high_cholesterol'])
        }));

        engine.setTestFoodTags(createFoodTags('Fried Egg', {
            healthFlags: new Set(['cholesterol_caution'])
        }));

        const result = await engine.validate('client1', 'food1', {
            currentDay: 'monday',
            mealType: 'breakfast'
        });

        assertEqual(result.severity, ValidationSeverity.YELLOW, 'Should be YELLOW severity');
        assertEqual(result.canAdd, true, 'Should allow adding with warning');
        assert(result.alerts.some(a => a.type === 'lab_derived'), 'Should have lab_derived alert');
    });

    // Test 8: Dislike Warning (YELLOW)
    await test('Disliked food shows warning', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({
            dislikes: new Set(['bitter gourd'])
        }));

        engine.setTestFoodTags(createFoodTags('Bitter Gourd', {}));

        const result = await engine.validate('client1', 'food1', {
            currentDay: 'monday',
            mealType: 'lunch'
        });

        assertEqual(result.severity, ValidationSeverity.YELLOW, 'Should be YELLOW severity');
        assertEqual(result.canAdd, true, 'Should allow adding with warning');
        assert(result.alerts.some(a => a.type === 'dislike'), 'Should have dislike alert');
    });

    // Test 9: Liked Food Positive (GREEN)
    await test('Liked food shows positive indicator', async () => {
        const engine = new TestableValidationEngine();

        const foodId = 'food_egg_roll';
        engine.setTestClientTags(createClientTags({
            likedFoods: new Set([foodId])
        }));

        engine.setTestFoodTags(createFoodTags('Egg Roll', { id: foodId }));

        const result = await engine.validate('client1', foodId, {
            currentDay: 'monday',
            mealType: 'lunch'
        });

        assertEqual(result.severity, ValidationSeverity.GREEN, 'Should be GREEN severity');
        assertEqual(result.canAdd, true, 'Should allow adding');
        assert(result.alerts.some(a => a.type === 'preference_match'), 'Should have preference_match alert');
    });

    // Test 10: Preferred Cuisine Positive (GREEN)
    await test('Preferred cuisine shows positive indicator', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({
            preferredCuisines: new Set(['indian', 'mughlai'])
        }));

        engine.setTestFoodTags(createFoodTags('Dal Makhani', {
            cuisineTags: new Set(['indian', 'punjabi'])
        }));

        const result = await engine.validate('client1', 'food1', {
            currentDay: 'monday',
            mealType: 'dinner'
        });

        assertEqual(result.severity, ValidationSeverity.GREEN, 'Should be GREEN severity');
        assertEqual(result.canAdd, true, 'Should allow adding');
        assert(result.alerts.some(a => a.type === 'cuisine_match'), 'Should have cuisine_match alert');
    });

    // Test 11: No restrictions - clean pass (GREEN)
    await test('No restrictions allows food with GREEN', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({}));
        engine.setTestFoodTags(createFoodTags('Brown Rice', {}));

        const result = await engine.validate('client1', 'food1', {
            currentDay: 'monday',
            mealType: 'lunch'
        });

        assertEqual(result.severity, ValidationSeverity.GREEN, 'Should be GREEN severity');
        assertEqual(result.canAdd, true, 'Should allow adding');
        assertEqual(result.borderColor, 'green', 'Border should be green');
    });

    // Test 12: Multiple alerts combination
    await test('Multiple warnings combine correctly', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({
            medicalConditions: new Set(['pre_diabetes', 'heart_pain']),
            preferredCuisines: new Set(['indian'])
        }));

        engine.setTestFoodTags(createFoodTags('Sweet Kheer', {
            nutritionTags: new Set(['high_sugar']),
            healthFlags: new Set(['cholesterol_caution']),
            cuisineTags: new Set(['indian'])
        }));

        const result = await engine.validate('client1', 'food1', {
            currentDay: 'monday',
            mealType: 'dessert' as any
        });

        assertEqual(result.severity, ValidationSeverity.YELLOW, 'Should be YELLOW (worst of warnings)');
        assertEqual(result.canAdd, true, 'Should still allow adding');
        assert(result.alerts.length >= 2, 'Should have multiple alerts');
    });

    // Test 13: Vegan blocks vegetarian food
    await test('Vegan client blocks vegetarian (non-vegan) food', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({
            dietPattern: 'vegan'
        }));

        engine.setTestFoodTags(createFoodTags('Paneer Tikka', {
            dietaryCategory: 'vegetarian'
        }));

        const result = await engine.validate('client1', 'food1', {
            currentDay: 'monday',
            mealType: 'dinner'
        });

        assertEqual(result.severity, ValidationSeverity.RED, 'Should be RED (vegan cannot eat vegetarian)');
        assertEqual(result.canAdd, false, 'Should not allow adding');
    });

    // ============ FOOD RESTRICTIONS TESTS ============

    // Test 14: Non-veg restricted on Tuesday (RED)
    await test('Non-veg restriction on Tuesday blocks chicken', async () => {
        const engine = new TestableValidationEngine();

        const restriction: FoodRestriction = {
            foodCategory: 'non_veg',
            restrictionType: 'day_based',
            avoidDays: ['tuesday', 'thursday'],
            severity: 'strict',
            reason: 'religious_fasting'
        };

        engine.setTestClientTags(createClientTags({
            foodRestrictions: [restriction]
        }));

        engine.setTestFoodTags(createFoodTags('Chicken Curry', {
            dietaryCategory: 'non_veg'
        }));

        const result = await engine.validate('client1', 'food1', {
            currentDay: 'tuesday',
            mealType: 'lunch'
        });

        assertEqual(result.severity, ValidationSeverity.RED, 'Should be RED on restriction day');
        assertEqual(result.canAdd, false, 'Should not allow adding');
        assert(result.alerts.some(a => a.type === 'food_restriction'), 'Should have food_restriction alert');
    });

    // Test 15: Non-veg allowed on Wednesday (no restriction)
    await test('Non-veg restriction allows chicken on unrestricted day', async () => {
        const engine = new TestableValidationEngine();

        const restriction: FoodRestriction = {
            foodCategory: 'non_veg',
            restrictionType: 'day_based',
            avoidDays: ['tuesday', 'thursday'],
            severity: 'strict',
            reason: 'religious_fasting'
        };

        engine.setTestClientTags(createClientTags({
            foodRestrictions: [restriction]
        }));

        engine.setTestFoodTags(createFoodTags('Chicken Curry', {
            dietaryCategory: 'non_veg'
        }));

        const result = await engine.validate('client1', 'food1', {
            currentDay: 'wednesday',
            mealType: 'lunch'
        });

        assertEqual(result.canAdd, true, 'Should allow adding on Wednesday');
        assert(result.severity !== ValidationSeverity.RED, 'Should not be RED on Wednesday');
    });

    // Test 16: Non-veg restricted BUT eggs excluded (eggs should be allowed)
    await test('Non-veg restriction with excludes allows eggs on restricted day', async () => {
        const engine = new TestableValidationEngine();

        const restriction: FoodRestriction = {
            foodCategory: 'non_veg',
            restrictionType: 'day_based',
            avoidDays: ['tuesday', 'thursday'],
            excludes: ['eggs'],  // Eggs are allowed even on restriction days
            severity: 'strict',
            reason: 'religious_fasting'
        };

        engine.setTestClientTags(createClientTags({
            foodRestrictions: [restriction]
        }));

        engine.setTestFoodTags(createFoodTags('Egg Omelette', {
            dietaryCategory: 'non_veg',
            allergenFlags: new Set(['eggs'])
        }));

        const result = await engine.validate('client1', 'food1', {
            currentDay: 'tuesday',
            mealType: 'breakfast'
        });

        assertEqual(result.canAdd, true, 'Should allow eggs even on Tuesday');
        assert(result.severity !== ValidationSeverity.RED, 'Should not be blocked');
    });

    // Test 17: Always restriction blocks food on any day
    await test('Always restriction blocks food on any day', async () => {
        const engine = new TestableValidationEngine();

        const restriction: FoodRestriction = {
            foodCategory: 'root_vegetables',
            restrictionType: 'always',
            includes: ['onion', 'garlic'],
            severity: 'strict',
            reason: 'jain_diet'
        };

        engine.setTestClientTags(createClientTags({
            foodRestrictions: [restriction]
        }));

        engine.setTestFoodTags(createFoodTags('Onion Rings', {}));

        const result = await engine.validate('client1', 'food1', {
            currentDay: 'wednesday',
            mealType: 'snack'
        });

        assertEqual(result.severity, ValidationSeverity.RED, 'Should be blocked always');
        assertEqual(result.canAdd, false, 'Should not allow adding');
    });

    // Test 18: Flexible restriction shows warning (YELLOW)
    await test('Flexible restriction shows warning not block', async () => {
        const engine = new TestableValidationEngine();

        const restriction: FoodRestriction = {
            foodName: 'rice',
            restrictionType: 'quantity',
            maxGramsPerMeal: 100,
            severity: 'flexible',  // YELLOW not RED
            reason: 'diabetes_management'
        };

        engine.setTestClientTags(createClientTags({
            foodRestrictions: [restriction]
        }));

        engine.setTestFoodTags(createFoodTags('White Rice', {}));

        const result = await engine.validate('client1', 'food1', {
            currentDay: 'monday',
            mealType: 'lunch'
        });

        assertEqual(result.severity, ValidationSeverity.YELLOW, 'Should be YELLOW for flexible restriction');
        assertEqual(result.canAdd, true, 'Should allow adding with warning');
        assert(result.alerts.some(a => a.type === 'food_restriction'), 'Should have food_restriction alert');
    });

    // ============ REPETITION TESTS ============

    // Test 19: Repetition check triggers YELLOW when threshold exceeded
    await test('Repetition check triggers YELLOW when food appears 4 times', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({}));
        engine.setTestFoodTags(createFoodTags('White Rice', { id: 'food_white_rice' }));
        engine.setTestRepetitionCount(4);

        const result = await engine.validate('client1', 'food_white_rice', {
            currentDay: 'monday',
            mealType: 'lunch',
            planId: 'plan_123'
        });

        assertEqual(result.canAdd, true, 'Should allow adding with warning');
        assert(result.alerts.some(a => a.type === 'repetition'), 'Should have repetition alert');
        assert(result.alerts.some(a => a.severity === ValidationSeverity.YELLOW), 'Repetition alert should be YELLOW');
    });

    // Test 20: Repetition check does NOT trigger when under threshold
    await test('Repetition check does not trigger when food appears 2 times', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({}));
        engine.setTestFoodTags(createFoodTags('Brown Rice', { id: 'food_brown_rice' }));
        engine.setTestRepetitionCount(2);

        const result = await engine.validate('client1', 'food_brown_rice', {
            currentDay: 'monday',
            mealType: 'lunch',
            planId: 'plan_123'
        });

        assert(!result.alerts.some(a => a.type === 'repetition'), 'Should NOT have repetition alert');
    });

    // Test 21: No repetition check without planId
    await test('Repetition check skipped without planId', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({}));
        engine.setTestFoodTags(createFoodTags('White Rice', { id: 'food_white_rice' }));
        engine.setTestRepetitionCount(10);

        const result = await engine.validate('client1', 'food_white_rice', {
            currentDay: 'monday',
            mealType: 'lunch'
            // No planId
        });

        assert(!result.alerts.some(a => a.type === 'repetition'), 'Should NOT have repetition alert without planId');
    });

    // ============ NUTRITION STRENGTH TESTS ============

    // Test 22: Nutrition strength triggers YELLOW when food exceeds calorie threshold
    await test('Nutrition strength triggers YELLOW for high calorie food', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({}));
        engine.setTestFoodTags(createFoodTags('Biryani', {
            id: 'food_biryani',
            calories: 600
        }));
        engine.setTestPlanTargets({
            targetCalories: 1000,
            targetProteinG: null,
            targetCarbsG: null,
            targetFatsG: null
        });

        const result = await engine.validate('client1', 'food_biryani', {
            currentDay: 'monday',
            mealType: 'lunch',
            planId: 'plan_123'
        });

        assertEqual(result.canAdd, true, 'Should allow adding with warning');
        assert(result.alerts.some(a => a.type === 'nutrition_strength'), 'Should have nutrition_strength alert');
        assert(
            result.alerts.some(a => a.message.includes('60%')),
            'Should mention 60% in message'
        );
    });

    // Test 23: Nutrition strength does NOT trigger when under threshold
    await test('Nutrition strength does not trigger for low calorie food', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({}));
        engine.setTestFoodTags(createFoodTags('Salad', {
            id: 'food_salad',
            calories: 200
        }));
        engine.setTestPlanTargets({
            targetCalories: 2000,
            targetProteinG: null,
            targetCarbsG: null,
            targetFatsG: null
        });

        const result = await engine.validate('client1', 'food_salad', {
            currentDay: 'monday',
            mealType: 'lunch',
            planId: 'plan_123'
        });

        assert(!result.alerts.some(a => a.type === 'nutrition_strength'), 'Should NOT have nutrition_strength alert');
    });

    // Test 24: Nutrition strength triggers for high protein
    await test('Nutrition strength triggers YELLOW for high protein food', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({}));
        engine.setTestFoodTags(createFoodTags('Whey Protein Shake', {
            id: 'food_whey',
            calories: 200,
            proteinG: 50
        }));
        engine.setTestPlanTargets({
            targetCalories: 2000,
            targetProteinG: 60,
            targetCarbsG: null,
            targetFatsG: null
        });

        const result = await engine.validate('client1', 'food_whey', {
            currentDay: 'monday',
            mealType: 'snack',
            planId: 'plan_123'
        });

        assert(result.alerts.some(a => a.type === 'nutrition_strength' && a.message.includes('PROTEIN')),
            'Should have nutrition_strength protein alert');
    });

    // Test 25: No nutrition strength check without planId
    await test('Nutrition strength check skipped without planId', async () => {
        const engine = new TestableValidationEngine();

        engine.setTestClientTags(createClientTags({}));
        engine.setTestFoodTags(createFoodTags('Biryani', {
            id: 'food_biryani',
            calories: 600
        }));
        engine.setTestPlanTargets({
            targetCalories: 1000,
            targetProteinG: null,
            targetCarbsG: null,
            targetFatsG: null
        });

        const result = await engine.validate('client1', 'food_biryani', {
            currentDay: 'monday',
            mealType: 'lunch'
            // No planId
        });

        assert(!result.alerts.some(a => a.type === 'nutrition_strength'), 'Should NOT have nutrition_strength alert without planId');
    });

    // ============ SUMMARY ============
    console.log('\n' + '='.repeat(50));
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

// Run tests
runTests().catch(console.error);
