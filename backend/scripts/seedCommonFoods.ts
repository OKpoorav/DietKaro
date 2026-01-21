/**
 * Seed script for common Indian foods with tags
 * Run with: npx tsx scripts/seedCommonFoods.ts
 */

import prisma from '../src/utils/prisma';
import { foodTaggingService } from '../src/services/foodTagging.service';

interface FoodSeed {
    name: string;
    category: string;
    calories: number;
    proteinG?: number;
    carbsG?: number;
    fatsG?: number;
    fiberG?: number;
    sugarG?: number;
    sodiumMg?: number;
    dietaryCategory: string;
}

// Common Indian foods with nutrition per 100g
const COMMON_FOODS: FoodSeed[] = [
    // Breakfast items
    { name: 'Idli', category: 'Breakfast', calories: 39, proteinG: 1.5, carbsG: 8, fatsG: 0.2, fiberG: 0.3, dietaryCategory: 'vegetarian' },
    { name: 'Dosa', category: 'Breakfast', calories: 89, proteinG: 2, carbsG: 12, fatsG: 3.5, fiberG: 0.5, dietaryCategory: 'vegetarian' },
    { name: 'Upma', category: 'Breakfast', calories: 110, proteinG: 3, carbsG: 17, fatsG: 3.5, fiberG: 1, dietaryCategory: 'vegetarian' },
    { name: 'Poha', category: 'Breakfast', calories: 130, proteinG: 2.5, carbsG: 20, fatsG: 4, fiberG: 1, dietaryCategory: 'vegetarian' },
    { name: 'Paratha', category: 'Breakfast', calories: 260, proteinG: 5, carbsG: 32, fatsG: 12, fiberG: 2, dietaryCategory: 'vegetarian' },
    { name: 'Aloo Paratha', category: 'Breakfast', calories: 280, proteinG: 6, carbsG: 35, fatsG: 13, fiberG: 2.5, dietaryCategory: 'vegetarian' },
    { name: 'Egg Omelette', category: 'Breakfast', calories: 154, proteinG: 11, carbsG: 1, fatsG: 12, dietaryCategory: 'non_veg' },
    { name: 'Boiled Eggs (2)', category: 'Breakfast', calories: 155, proteinG: 13, carbsG: 1.1, fatsG: 11, dietaryCategory: 'non_veg' },
    { name: 'Cheela (Besan)', category: 'Breakfast', calories: 180, proteinG: 7, carbsG: 18, fatsG: 8, fiberG: 3, dietaryCategory: 'vegetarian' },

    // Rice & Rotis
    { name: 'White Rice (Cooked)', category: 'Grains', calories: 130, proteinG: 2.7, carbsG: 28, fatsG: 0.3, fiberG: 0.4, dietaryCategory: 'vegetarian' },
    { name: 'Brown Rice (Cooked)', category: 'Grains', calories: 111, proteinG: 2.6, carbsG: 23, fatsG: 0.9, fiberG: 1.8, dietaryCategory: 'vegetarian' },
    { name: 'Chapati (Wheat Roti)', category: 'Grains', calories: 71, proteinG: 2.7, carbsG: 15, fatsG: 0.4, fiberG: 1.9, dietaryCategory: 'vegetarian' },
    { name: 'Naan', category: 'Grains', calories: 262, proteinG: 8, carbsG: 45, fatsG: 5, fiberG: 2, dietaryCategory: 'vegetarian' },
    { name: 'Jeera Rice', category: 'Grains', calories: 150, proteinG: 3, carbsG: 30, fatsG: 2, fiberG: 0.5, dietaryCategory: 'vegetarian' },

    // Dals & Legumes
    { name: 'Dal Tadka', category: 'Legumes', calories: 116, proteinG: 6.5, carbsG: 16, fatsG: 3, fiberG: 4, dietaryCategory: 'vegetarian' },
    { name: 'Chana Masala', category: 'Legumes', calories: 180, proteinG: 8.5, carbsG: 26, fatsG: 4.5, fiberG: 6, dietaryCategory: 'vegetarian' },
    { name: 'Rajma', category: 'Legumes', calories: 140, proteinG: 7, carbsG: 22, fatsG: 2.5, fiberG: 5, dietaryCategory: 'vegetarian' },
    { name: 'Sambhar', category: 'Legumes', calories: 65, proteinG: 3, carbsG: 10, fatsG: 1.5, fiberG: 2.5, dietaryCategory: 'vegetarian' },
    { name: 'Dal Makhani', category: 'Legumes', calories: 180, proteinG: 7, carbsG: 20, fatsG: 8, fiberG: 5, dietaryCategory: 'vegetarian' },

    // Vegetables
    { name: 'Aloo Gobi', category: 'Vegetables', calories: 90, proteinG: 2, carbsG: 12, fatsG: 4, fiberG: 2.5, dietaryCategory: 'vegetarian' },
    { name: 'Bhindi Masala', category: 'Vegetables', calories: 85, proteinG: 2.5, carbsG: 8, fatsG: 5, fiberG: 3, dietaryCategory: 'vegetarian' },
    { name: 'Palak Paneer', category: 'Vegetables', calories: 200, proteinG: 10, carbsG: 8, fatsG: 15, fiberG: 2, dietaryCategory: 'vegetarian' },
    { name: 'Paneer Butter Masala', category: 'Vegetables', calories: 280, proteinG: 12, carbsG: 10, fatsG: 22, fiberG: 1, dietaryCategory: 'vegetarian' },
    { name: 'Mixed Veg Curry', category: 'Vegetables', calories: 100, proteinG: 3, carbsG: 12, fatsG: 4.5, fiberG: 3, dietaryCategory: 'vegetarian' },
    { name: 'Baingan Bharta', category: 'Vegetables', calories: 110, proteinG: 2, carbsG: 10, fatsG: 7, fiberG: 3, dietaryCategory: 'vegetarian' },

    // Non-Veg Curries
    { name: 'Butter Chicken', category: 'Non-Veg', calories: 245, proteinG: 16, carbsG: 6, fatsG: 18, dietaryCategory: 'non_veg' },
    { name: 'Chicken Curry', category: 'Non-Veg', calories: 180, proteinG: 18, carbsG: 4, fatsG: 10, dietaryCategory: 'non_veg' },
    { name: 'Mutton Curry', category: 'Non-Veg', calories: 250, proteinG: 20, carbsG: 5, fatsG: 17, dietaryCategory: 'non_veg' },
    { name: 'Fish Curry', category: 'Non-Veg', calories: 135, proteinG: 18, carbsG: 3, fatsG: 5.5, dietaryCategory: 'non_veg' },
    { name: 'Egg Curry', category: 'Non-Veg', calories: 150, proteinG: 10, carbsG: 5, fatsG: 10, dietaryCategory: 'non_veg' },
    { name: 'Chicken Biryani', category: 'Non-Veg', calories: 190, proteinG: 8, carbsG: 25, fatsG: 6, dietaryCategory: 'non_veg' },
    { name: 'Tandoori Chicken', category: 'Non-Veg', calories: 165, proteinG: 25, carbsG: 3, fatsG: 6, dietaryCategory: 'non_veg' },

    // Snacks
    { name: 'Samosa (1 pc)', category: 'Snacks', calories: 260, proteinG: 4, carbsG: 30, fatsG: 14, fiberG: 2, dietaryCategory: 'vegetarian' },
    { name: 'Pakora', category: 'Snacks', calories: 240, proteinG: 6, carbsG: 20, fatsG: 15, fiberG: 2, dietaryCategory: 'vegetarian' },
    { name: 'Vada Pav', category: 'Snacks', calories: 290, proteinG: 5, carbsG: 35, fatsG: 14, dietaryCategory: 'vegetarian' },
    { name: 'Pav Bhaji', category: 'Snacks', calories: 320, proteinG: 6, carbsG: 40, fatsG: 15, fiberG: 4, dietaryCategory: 'vegetarian' },
    { name: 'Bhel Puri', category: 'Snacks', calories: 150, proteinG: 3, carbsG: 25, fatsG: 4, fiberG: 2, dietaryCategory: 'vegetarian' },

    // Dairy
    { name: 'Curd (Dahi)', category: 'Dairy', calories: 60, proteinG: 3.4, carbsG: 5, fatsG: 3.3, dietaryCategory: 'vegetarian' },
    { name: 'Paneer (100g)', category: 'Dairy', calories: 265, proteinG: 18, carbsG: 2, fatsG: 21, dietaryCategory: 'vegetarian' },
    { name: 'Lassi (Sweet)', category: 'Dairy', calories: 100, proteinG: 3, carbsG: 18, fatsG: 2, sugarG: 15, dietaryCategory: 'vegetarian' },
    { name: 'Buttermilk (Chaas)', category: 'Dairy', calories: 25, proteinG: 2, carbsG: 3, fatsG: 0.5, dietaryCategory: 'vegetarian' },

    // Sweets
    { name: 'Gulab Jamun (1 pc)', category: 'Sweets', calories: 175, proteinG: 2, carbsG: 28, fatsG: 6, sugarG: 22, dietaryCategory: 'vegetarian' },
    { name: 'Rasgulla (1 pc)', category: 'Sweets', calories: 120, proteinG: 3, carbsG: 22, fatsG: 2, sugarG: 18, dietaryCategory: 'vegetarian' },
    { name: 'Kheer', category: 'Sweets', calories: 140, proteinG: 4, carbsG: 22, fatsG: 4, sugarG: 16, dietaryCategory: 'vegetarian' },
    { name: 'Jalebi (2 pcs)', category: 'Sweets', calories: 180, proteinG: 1, carbsG: 35, fatsG: 4, sugarG: 28, dietaryCategory: 'vegetarian' },

    // Fruits
    { name: 'Banana', category: 'Fruits', calories: 89, proteinG: 1.1, carbsG: 23, fatsG: 0.3, fiberG: 2.6, sugarG: 12, dietaryCategory: 'vegan' },
    { name: 'Apple', category: 'Fruits', calories: 52, proteinG: 0.3, carbsG: 14, fatsG: 0.2, fiberG: 2.4, sugarG: 10, dietaryCategory: 'vegan' },
    { name: 'Mango', category: 'Fruits', calories: 60, proteinG: 0.8, carbsG: 15, fatsG: 0.4, fiberG: 1.6, sugarG: 14, dietaryCategory: 'vegan' },
    { name: 'Papaya', category: 'Fruits', calories: 43, proteinG: 0.5, carbsG: 11, fatsG: 0.3, fiberG: 1.7, sugarG: 8, dietaryCategory: 'vegan' },

    // Beverages
    { name: 'Chai (with milk & sugar)', category: 'Beverages', calories: 65, proteinG: 2, carbsG: 10, fatsG: 2, sugarG: 8, dietaryCategory: 'vegetarian' },
    { name: 'Coffee (with milk)', category: 'Beverages', calories: 50, proteinG: 1.5, carbsG: 6, fatsG: 2, sugarG: 5, dietaryCategory: 'vegetarian' },
    { name: 'Nimbu Pani', category: 'Beverages', calories: 40, proteinG: 0, carbsG: 10, fatsG: 0, sugarG: 8, dietaryCategory: 'vegan' },
    { name: 'Coconut Water', category: 'Beverages', calories: 19, proteinG: 0.7, carbsG: 4, fatsG: 0.2, sugarG: 2.6, dietaryCategory: 'vegan' },
];

async function seedCommonFoods() {
    console.log('🌱 Starting food seed...\n');

    let created = 0;
    let skipped = 0;

    for (const food of COMMON_FOODS) {
        // Check if food already exists (by name)
        const existing = await prisma.foodItem.findFirst({
            where: {
                name: { equals: food.name, mode: 'insensitive' },
                orgId: null // Global foods
            }
        });

        if (existing) {
            console.log(`⏭️  Skipped (exists): ${food.name}`);
            skipped++;
            continue;
        }

        // Create food item
        const newFood = await prisma.foodItem.create({
            data: {
                orgId: null, // Global food
                name: food.name,
                category: food.category,
                servingSizeG: 100,
                calories: food.calories,
                proteinG: food.proteinG,
                carbsG: food.carbsG,
                fatsG: food.fatsG,
                fiberG: food.fiberG,
                sugarG: food.sugarG,
                sodiumMg: food.sodiumMg,
                dietaryCategory: food.dietaryCategory,
                isVerified: true,
                source: 'seed_data'
            }
        });

        // Auto-tag with detection
        await foodTaggingService.autoTagFood(newFood.id);

        console.log(`✅ Created: ${food.name} (${food.dietaryCategory})`);
        created++;
    }

    console.log(`\n📊 Summary: Created ${created}, Skipped ${skipped}`);
    console.log('✅ Seed complete!');
}

// Run
seedCommonFoods()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
