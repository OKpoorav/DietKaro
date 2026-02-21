/**
 * Seed script for common base ingredients.
 * Run: npx tsx prisma/seed-ingredients.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BaseIngredientSeed {
    name: string;
    category: string;
    calories: number;
    proteinG?: number;
    carbsG?: number;
    fatsG?: number;
    allergenFlags: string[];
    dietaryCategory: string;
}

const BASE_INGREDIENTS: BaseIngredientSeed[] = [
    // Dairy
    { name: 'Milk', category: 'Dairy', calories: 42, proteinG: 3.4, carbsG: 5, fatsG: 1, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },
    { name: 'Cheese', category: 'Dairy', calories: 402, proteinG: 25, carbsG: 1.3, fatsG: 33, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },
    { name: 'Butter', category: 'Dairy', calories: 717, proteinG: 0.9, carbsG: 0.1, fatsG: 81, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },
    { name: 'Ghee', category: 'Dairy', calories: 900, proteinG: 0, carbsG: 0, fatsG: 100, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },
    { name: 'Paneer', category: 'Dairy', calories: 265, proteinG: 18, carbsG: 1.2, fatsG: 21, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },
    { name: 'Curd / Yogurt', category: 'Dairy', calories: 60, proteinG: 3.5, carbsG: 4.7, fatsG: 3.3, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },
    { name: 'Cream', category: 'Dairy', calories: 340, proteinG: 2.1, carbsG: 2.8, fatsG: 36, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },

    // Grains
    { name: 'Wheat Flour', category: 'Grains', calories: 340, proteinG: 13, carbsG: 72, fatsG: 1.5, allergenFlags: ['wheat', 'gluten'], dietaryCategory: 'vegan' },
    { name: 'Maida', category: 'Grains', calories: 350, proteinG: 11, carbsG: 74, fatsG: 1.2, allergenFlags: ['wheat', 'gluten'], dietaryCategory: 'vegan' },
    { name: 'Bread', category: 'Grains', calories: 265, proteinG: 9, carbsG: 49, fatsG: 3.2, allergenFlags: ['wheat', 'gluten'], dietaryCategory: 'vegan' },
    { name: 'Rice', category: 'Grains', calories: 130, proteinG: 2.7, carbsG: 28, fatsG: 0.3, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Oats', category: 'Grains', calories: 389, proteinG: 17, carbsG: 66, fatsG: 7, allergenFlags: [], dietaryCategory: 'vegan' },

    // Proteins
    { name: 'Egg', category: 'Proteins', calories: 155, proteinG: 13, carbsG: 1.1, fatsG: 11, allergenFlags: ['eggs'], dietaryCategory: 'veg_with_egg' },
    { name: 'Chicken', category: 'Proteins', calories: 239, proteinG: 27, carbsG: 0, fatsG: 14, allergenFlags: [], dietaryCategory: 'non_veg' },
    { name: 'Fish', category: 'Proteins', calories: 206, proteinG: 22, carbsG: 0, fatsG: 12, allergenFlags: ['fish'], dietaryCategory: 'non_veg' },
    { name: 'Prawns', category: 'Proteins', calories: 99, proteinG: 24, carbsG: 0.2, fatsG: 0.3, allergenFlags: ['shellfish'], dietaryCategory: 'non_veg' },
    { name: 'Mutton', category: 'Proteins', calories: 294, proteinG: 25, carbsG: 0, fatsG: 21, allergenFlags: [], dietaryCategory: 'non_veg' },

    // Legumes & Nuts
    { name: 'Peanuts', category: 'Proteins', calories: 567, proteinG: 26, carbsG: 16, fatsG: 49, allergenFlags: ['peanuts'], dietaryCategory: 'vegan' },
    { name: 'Almonds', category: 'Proteins', calories: 579, proteinG: 21, carbsG: 22, fatsG: 50, allergenFlags: ['tree_nuts'], dietaryCategory: 'vegan' },
    { name: 'Cashews', category: 'Proteins', calories: 553, proteinG: 18, carbsG: 30, fatsG: 44, allergenFlags: ['tree_nuts'], dietaryCategory: 'vegan' },
    { name: 'Walnuts', category: 'Proteins', calories: 654, proteinG: 15, carbsG: 14, fatsG: 65, allergenFlags: ['tree_nuts'], dietaryCategory: 'vegan' },
    { name: 'Soy', category: 'Proteins', calories: 173, proteinG: 17, carbsG: 10, fatsG: 9, allergenFlags: ['soy'], dietaryCategory: 'vegan' },
    { name: 'Tofu', category: 'Proteins', calories: 76, proteinG: 8, carbsG: 1.9, fatsG: 4.8, allergenFlags: ['soy'], dietaryCategory: 'vegan' },

    // Vegetables & basics
    { name: 'Onion', category: 'Vegetables', calories: 40, proteinG: 1.1, carbsG: 9.3, fatsG: 0.1, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Garlic', category: 'Vegetables', calories: 149, proteinG: 6.4, carbsG: 33, fatsG: 0.5, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Tomato', category: 'Vegetables', calories: 18, proteinG: 0.9, carbsG: 3.9, fatsG: 0.2, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Potato', category: 'Vegetables', calories: 77, proteinG: 2, carbsG: 17, fatsG: 0.1, allergenFlags: [], dietaryCategory: 'vegan' },

    // Oils & Seeds
    { name: 'Sesame Seeds', category: 'Other', calories: 573, proteinG: 18, carbsG: 23, fatsG: 50, allergenFlags: ['sesame'], dietaryCategory: 'vegan' },
    { name: 'Coconut Oil', category: 'Other', calories: 862, proteinG: 0, carbsG: 0, fatsG: 100, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Olive Oil', category: 'Other', calories: 884, proteinG: 0, carbsG: 0, fatsG: 100, allergenFlags: [], dietaryCategory: 'vegan' },
];

async function main() {
    console.log('Seeding base ingredients...');

    let created = 0;
    let skipped = 0;

    for (const item of BASE_INGREDIENTS) {
        // Check if already exists (global, same name)
        const existing = await prisma.foodItem.findFirst({
            where: { name: item.name, orgId: null, isBaseIngredient: true },
        });

        if (existing) {
            skipped++;
            continue;
        }

        await prisma.foodItem.create({
            data: {
                orgId: null,
                name: item.name,
                category: item.category,
                servingSizeG: 100,
                calories: item.calories,
                proteinG: item.proteinG,
                carbsG: item.carbsG,
                fatsG: item.fatsG,
                allergenFlags: item.allergenFlags,
                dietaryTags: [],
                dietaryCategory: item.dietaryCategory,
                isBaseIngredient: true,
                isVerified: true,
                source: 'seed',
            },
        });
        created++;
    }

    console.log(`Done! Created: ${created}, Skipped (already exist): ${skipped}`);
}

main()
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
