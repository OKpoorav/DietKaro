/**
 * Seed script for base ingredients (raw foods, proteins, vegetables, fruits, etc.)
 * All values per 100g. Source: USDA FoodData Central + NIN India (ICMR).
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
    fiberG?: number;
    sugarG?: number;
    sodiumMg?: number;
    allergenFlags: string[];
    dietaryCategory: string;
}

const BASE_INGREDIENTS: BaseIngredientSeed[] = [

    // ─── Dairy ───────────────────────────────────────────────────────────────
    { name: 'Milk (Whole)', category: 'Dairy', calories: 61, proteinG: 3.2, carbsG: 4.8, fatsG: 3.3, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },
    { name: 'Milk (Skim/Toned)', category: 'Dairy', calories: 34, proteinG: 3.4, carbsG: 5.0, fatsG: 0.1, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },
    { name: 'Cheese (Cheddar)', category: 'Dairy', calories: 402, proteinG: 25, carbsG: 1.3, fatsG: 33, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },
    { name: 'Butter', category: 'Dairy', calories: 717, proteinG: 0.9, carbsG: 0.1, fatsG: 81, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },
    { name: 'Ghee', category: 'Dairy', calories: 900, proteinG: 0, carbsG: 0, fatsG: 100, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },
    { name: 'Paneer', category: 'Dairy', calories: 265, proteinG: 18, carbsG: 1.2, fatsG: 21, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },
    { name: 'Curd / Yogurt', category: 'Dairy', calories: 60, proteinG: 3.5, carbsG: 4.7, fatsG: 3.3, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },
    { name: 'Greek Yogurt', category: 'Dairy', calories: 59, proteinG: 10.2, carbsG: 3.6, fatsG: 0.4, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },
    { name: 'Cream', category: 'Dairy', calories: 340, proteinG: 2.1, carbsG: 2.8, fatsG: 36, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },
    { name: 'Whey Protein', category: 'Dairy', calories: 400, proteinG: 80, carbsG: 8, fatsG: 5, allergenFlags: ['milk', 'lactose'], dietaryCategory: 'vegetarian' },

    // ─── Eggs ────────────────────────────────────────────────────────────────
    { name: 'Egg (Whole)', category: 'Proteins', calories: 155, proteinG: 13, carbsG: 1.1, fatsG: 11, allergenFlags: ['eggs'], dietaryCategory: 'veg_with_egg' },
    { name: 'Egg White', category: 'Proteins', calories: 52, proteinG: 10.9, carbsG: 0.7, fatsG: 0.2, allergenFlags: ['eggs'], dietaryCategory: 'veg_with_egg' },
    { name: 'Egg Yolk', category: 'Proteins', calories: 322, proteinG: 15.9, carbsG: 3.6, fatsG: 26.5, allergenFlags: ['eggs'], dietaryCategory: 'veg_with_egg' },

    // ─── Poultry ──────────────────────────────────────────────────────────────
    { name: 'Chicken Breast (Boneless, Raw)', category: 'Proteins', calories: 120, proteinG: 22.5, carbsG: 0, fatsG: 2.6, allergenFlags: [], dietaryCategory: 'non_veg' },
    { name: 'Chicken Thigh (Raw)', category: 'Proteins', calories: 177, proteinG: 20.1, carbsG: 0, fatsG: 10.9, allergenFlags: [], dietaryCategory: 'non_veg' },
    { name: 'Chicken Drumstick (Raw)', category: 'Proteins', calories: 143, proteinG: 19.6, carbsG: 0, fatsG: 7.1, allergenFlags: [], dietaryCategory: 'non_veg' },
    { name: 'Chicken (Whole, Raw)', category: 'Proteins', calories: 215, proteinG: 18.6, carbsG: 0, fatsG: 15.1, allergenFlags: [], dietaryCategory: 'non_veg' },
    { name: 'Mutton / Lamb (Raw)', category: 'Proteins', calories: 294, proteinG: 25, carbsG: 0, fatsG: 21, allergenFlags: [], dietaryCategory: 'non_veg' },
    { name: 'Pork (Raw)', category: 'Proteins', calories: 242, proteinG: 27.3, carbsG: 0, fatsG: 14.4, allergenFlags: [], dietaryCategory: 'non_veg' },

    // ─── Fish & Seafood ───────────────────────────────────────────────────────
    { name: 'Rohu Fish', category: 'Proteins', calories: 97, proteinG: 16.6, carbsG: 0, fatsG: 2.8, allergenFlags: ['fish'], dietaryCategory: 'non_veg' },
    { name: 'Pomfret (White)', category: 'Proteins', calories: 96, proteinG: 18.2, carbsG: 0, fatsG: 2.0, allergenFlags: ['fish'], dietaryCategory: 'non_veg' },
    { name: 'Surmai / King Fish', category: 'Proteins', calories: 108, proteinG: 23.7, carbsG: 0, fatsG: 0.7, allergenFlags: ['fish'], dietaryCategory: 'non_veg' },
    { name: 'Hilsa / Ilish', category: 'Proteins', calories: 273, proteinG: 21.8, carbsG: 0, fatsG: 19.4, allergenFlags: ['fish'], dietaryCategory: 'non_veg' },
    { name: 'Catla Fish', category: 'Proteins', calories: 106, proteinG: 17.2, carbsG: 0, fatsG: 3.7, allergenFlags: ['fish'], dietaryCategory: 'non_veg' },
    { name: 'Tilapia', category: 'Proteins', calories: 96, proteinG: 20.1, carbsG: 0, fatsG: 1.7, allergenFlags: ['fish'], dietaryCategory: 'non_veg' },
    { name: 'Salmon', category: 'Proteins', calories: 208, proteinG: 20.0, carbsG: 0, fatsG: 13.4, allergenFlags: ['fish'], dietaryCategory: 'non_veg' },
    { name: 'Tuna (Fresh)', category: 'Proteins', calories: 144, proteinG: 23.3, carbsG: 0, fatsG: 4.9, allergenFlags: ['fish'], dietaryCategory: 'non_veg' },
    { name: 'Tuna (Canned in Water)', category: 'Proteins', calories: 116, proteinG: 25.5, carbsG: 0, fatsG: 0.8, allergenFlags: ['fish'], dietaryCategory: 'non_veg' },
    { name: 'Prawns / Shrimp', category: 'Proteins', calories: 99, proteinG: 24, carbsG: 0.2, fatsG: 0.3, allergenFlags: ['shellfish'], dietaryCategory: 'non_veg' },
    { name: 'Crab', category: 'Proteins', calories: 83, proteinG: 18.1, carbsG: 0, fatsG: 0.5, allergenFlags: ['shellfish'], dietaryCategory: 'non_veg' },
    { name: 'Mackerel / Bangda', category: 'Proteins', calories: 205, proteinG: 19.0, carbsG: 0, fatsG: 13.9, allergenFlags: ['fish'], dietaryCategory: 'non_veg' },

    // ─── Pulses & Legumes (Raw/Dry) ───────────────────────────────────────────
    { name: 'Moong Dal (Yellow)', category: 'Legumes', calories: 347, proteinG: 24.0, carbsG: 59.9, fatsG: 1.2, fiberG: 16.3, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Masoor Dal (Red Lentil)', category: 'Legumes', calories: 353, proteinG: 24.6, carbsG: 60.1, fatsG: 1.1, fiberG: 10.7, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Toor Dal (Pigeon Pea)', category: 'Legumes', calories: 343, proteinG: 22.3, carbsG: 62.8, fatsG: 1.5, fiberG: 15.0, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Chana Dal (Split Chickpea)', category: 'Legumes', calories: 364, proteinG: 22.5, carbsG: 60.9, fatsG: 5.6, fiberG: 17.4, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Urad Dal (Black Gram Split)', category: 'Legumes', calories: 341, proteinG: 25.2, carbsG: 58.9, fatsG: 1.6, fiberG: 18.3, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Kabuli Chana (White Chickpea)', category: 'Legumes', calories: 364, proteinG: 19.3, carbsG: 60.7, fatsG: 6.0, fiberG: 17.4, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Kala Chana (Black Chickpea)', category: 'Legumes', calories: 378, proteinG: 19.3, carbsG: 64.2, fatsG: 5.6, fiberG: 17.0, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Rajma (Kidney Beans, Dry)', category: 'Legumes', calories: 347, proteinG: 22.5, carbsG: 62.7, fatsG: 1.5, fiberG: 24.9, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Moong Beans (Whole Green)', category: 'Legumes', calories: 347, proteinG: 23.9, carbsG: 62.6, fatsG: 1.2, fiberG: 16.3, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Soy Beans (Dry)', category: 'Legumes', calories: 446, proteinG: 36.5, carbsG: 30.2, fatsG: 19.9, fiberG: 9.3, allergenFlags: ['soy'], dietaryCategory: 'vegan' },
    { name: 'Peanuts', category: 'Legumes', calories: 567, proteinG: 26, carbsG: 16, fatsG: 49, allergenFlags: ['peanuts'], dietaryCategory: 'vegan' },

    // ─── Nuts & Dry Fruits ────────────────────────────────────────────────────
    { name: 'Almonds', category: 'Nuts & Seeds', calories: 579, proteinG: 21, carbsG: 22, fatsG: 50, fiberG: 12.5, allergenFlags: ['tree_nuts'], dietaryCategory: 'vegan' },
    { name: 'Cashews', category: 'Nuts & Seeds', calories: 553, proteinG: 18, carbsG: 30, fatsG: 44, fiberG: 3.3, allergenFlags: ['tree_nuts'], dietaryCategory: 'vegan' },
    { name: 'Walnuts', category: 'Nuts & Seeds', calories: 654, proteinG: 15, carbsG: 14, fatsG: 65, fiberG: 6.7, allergenFlags: ['tree_nuts'], dietaryCategory: 'vegan' },
    { name: 'Pistachios', category: 'Nuts & Seeds', calories: 562, proteinG: 20.2, carbsG: 27.5, fatsG: 45.3, fiberG: 10.3, allergenFlags: ['tree_nuts'], dietaryCategory: 'vegan' },
    { name: 'Dates (Dried)', category: 'Nuts & Seeds', calories: 282, proteinG: 2.5, carbsG: 75.0, fatsG: 0.4, fiberG: 8.0, sugarG: 66.5, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Raisins', category: 'Nuts & Seeds', calories: 299, proteinG: 3.1, carbsG: 79.2, fatsG: 0.5, fiberG: 3.7, sugarG: 59.2, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Figs (Dried / Anjeer)', category: 'Nuts & Seeds', calories: 249, proteinG: 3.3, carbsG: 63.9, fatsG: 0.9, fiberG: 9.8, sugarG: 47.9, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Apricots (Dried)', category: 'Nuts & Seeds', calories: 241, proteinG: 3.4, carbsG: 62.6, fatsG: 0.5, fiberG: 7.3, sugarG: 53.4, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Prunes (Dried Plum)', category: 'Nuts & Seeds', calories: 240, proteinG: 2.2, carbsG: 63.9, fatsG: 0.4, fiberG: 7.1, sugarG: 38.1, allergenFlags: [], dietaryCategory: 'vegan' },

    // ─── Seeds ────────────────────────────────────────────────────────────────
    { name: 'Flaxseeds', category: 'Nuts & Seeds', calories: 534, proteinG: 18.3, carbsG: 28.9, fatsG: 42.2, fiberG: 27.3, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Chia Seeds', category: 'Nuts & Seeds', calories: 486, proteinG: 16.5, carbsG: 42.1, fatsG: 30.7, fiberG: 34.4, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Sunflower Seeds', category: 'Nuts & Seeds', calories: 584, proteinG: 20.8, carbsG: 20.0, fatsG: 51.5, fiberG: 8.6, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Pumpkin Seeds', category: 'Nuts & Seeds', calories: 559, proteinG: 30.2, carbsG: 10.7, fatsG: 49.1, fiberG: 6.0, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Sesame Seeds', category: 'Nuts & Seeds', calories: 573, proteinG: 18, carbsG: 23, fatsG: 50, fiberG: 11.8, allergenFlags: ['sesame'], dietaryCategory: 'vegan' },

    // ─── Grains & Cereals ─────────────────────────────────────────────────────
    { name: 'Wheat Flour (Atta)', category: 'Grains', calories: 340, proteinG: 13, carbsG: 72, fatsG: 1.5, fiberG: 2.7, allergenFlags: ['wheat', 'gluten'], dietaryCategory: 'vegan' },
    { name: 'Maida (Refined Flour)', category: 'Grains', calories: 350, proteinG: 11, carbsG: 74, fatsG: 1.2, fiberG: 0.3, allergenFlags: ['wheat', 'gluten'], dietaryCategory: 'vegan' },
    { name: 'White Rice (Raw)', category: 'Grains', calories: 365, proteinG: 7.1, carbsG: 80, fatsG: 0.7, fiberG: 1.3, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Brown Rice (Raw)', category: 'Grains', calories: 370, proteinG: 7.9, carbsG: 77.2, fatsG: 2.9, fiberG: 3.5, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Oats (Rolled)', category: 'Grains', calories: 389, proteinG: 17, carbsG: 66, fatsG: 7, fiberG: 10.6, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Bread (White)', category: 'Grains', calories: 265, proteinG: 9, carbsG: 49, fatsG: 3.2, fiberG: 2.7, allergenFlags: ['wheat', 'gluten'], dietaryCategory: 'vegan' },
    { name: 'Bread (Brown/Whole Wheat)', category: 'Grains', calories: 247, proteinG: 12.4, carbsG: 46.0, fatsG: 3.5, fiberG: 6.8, allergenFlags: ['wheat', 'gluten'], dietaryCategory: 'vegan' },
    { name: 'Semolina (Sooji / Rava)', category: 'Grains', calories: 360, proteinG: 12.7, carbsG: 73.8, fatsG: 1.1, fiberG: 3.9, allergenFlags: ['wheat', 'gluten'], dietaryCategory: 'vegan' },
    { name: 'Besan (Chickpea Flour)', category: 'Grains', calories: 387, proteinG: 22.5, carbsG: 57.8, fatsG: 6.7, fiberG: 10.8, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Rice Flour', category: 'Grains', calories: 366, proteinG: 6.0, carbsG: 80.1, fatsG: 1.4, fiberG: 2.4, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Quinoa (Raw)', category: 'Grains', calories: 368, proteinG: 14.1, carbsG: 64.2, fatsG: 6.1, fiberG: 7.0, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Bajra (Pearl Millet)', category: 'Grains', calories: 378, proteinG: 11.6, carbsG: 67.5, fatsG: 5.0, fiberG: 11.5, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Jowar (Sorghum)', category: 'Grains', calories: 349, proteinG: 10.4, carbsG: 72.6, fatsG: 3.1, fiberG: 6.3, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Ragi (Finger Millet)', category: 'Grains', calories: 336, proteinG: 7.3, carbsG: 72.0, fatsG: 1.5, fiberG: 3.6, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Corn Flour (Makki Atta)', category: 'Grains', calories: 361, proteinG: 6.9, carbsG: 76.9, fatsG: 3.9, fiberG: 7.3, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Poha (Flattened Rice)', category: 'Grains', calories: 367, proteinG: 6.4, carbsG: 80.8, fatsG: 0.6, fiberG: 1.3, allergenFlags: [], dietaryCategory: 'vegan' },

    // ─── Raw Vegetables ───────────────────────────────────────────────────────
    { name: 'Onion', category: 'Vegetables', calories: 40, proteinG: 1.1, carbsG: 9.3, fatsG: 0.1, fiberG: 1.7, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Garlic', category: 'Vegetables', calories: 149, proteinG: 6.4, carbsG: 33.1, fatsG: 0.5, fiberG: 2.1, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Tomato', category: 'Vegetables', calories: 18, proteinG: 0.9, carbsG: 3.9, fatsG: 0.2, fiberG: 1.2, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Potato', category: 'Vegetables', calories: 77, proteinG: 2.0, carbsG: 17.0, fatsG: 0.1, fiberG: 2.2, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Sweet Potato', category: 'Vegetables', calories: 86, proteinG: 1.6, carbsG: 20.1, fatsG: 0.1, fiberG: 3.0, sugarG: 4.2, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Spinach (Palak)', category: 'Vegetables', calories: 23, proteinG: 2.9, carbsG: 3.6, fatsG: 0.4, fiberG: 2.2, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Broccoli', category: 'Vegetables', calories: 34, proteinG: 2.8, carbsG: 6.6, fatsG: 0.4, fiberG: 2.6, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Carrot', category: 'Vegetables', calories: 41, proteinG: 0.9, carbsG: 9.6, fatsG: 0.2, fiberG: 2.8, sugarG: 4.7, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Cucumber', category: 'Vegetables', calories: 16, proteinG: 0.7, carbsG: 3.6, fatsG: 0.1, fiberG: 0.5, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Beetroot', category: 'Vegetables', calories: 43, proteinG: 1.6, carbsG: 9.6, fatsG: 0.2, fiberG: 2.8, sugarG: 6.8, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Capsicum / Bell Pepper (Green)', category: 'Vegetables', calories: 20, proteinG: 0.9, carbsG: 4.6, fatsG: 0.2, fiberG: 1.7, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Capsicum / Bell Pepper (Red)', category: 'Vegetables', calories: 31, proteinG: 1.0, carbsG: 6.0, fatsG: 0.3, fiberG: 2.1, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Cauliflower', category: 'Vegetables', calories: 25, proteinG: 1.9, carbsG: 4.9, fatsG: 0.3, fiberG: 2.0, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Cabbage', category: 'Vegetables', calories: 25, proteinG: 1.3, carbsG: 5.8, fatsG: 0.1, fiberG: 2.5, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Green Peas (Fresh)', category: 'Vegetables', calories: 81, proteinG: 5.4, carbsG: 14.5, fatsG: 0.4, fiberG: 5.1, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Sweet Corn (Raw)', category: 'Vegetables', calories: 86, proteinG: 3.3, carbsG: 19.0, fatsG: 1.4, fiberG: 2.7, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Pumpkin / Kaddu', category: 'Vegetables', calories: 26, proteinG: 1.0, carbsG: 6.5, fatsG: 0.1, fiberG: 0.5, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Bitter Gourd (Karela)', category: 'Vegetables', calories: 17, proteinG: 1.0, carbsG: 3.7, fatsG: 0.2, fiberG: 2.8, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Bottle Gourd (Lauki)', category: 'Vegetables', calories: 14, proteinG: 0.6, carbsG: 3.4, fatsG: 0.1, fiberG: 0.5, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Ridge Gourd (Turai)', category: 'Vegetables', calories: 20, proteinG: 0.7, carbsG: 4.7, fatsG: 0.2, fiberG: 0.5, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Drumstick (Moringa Pods)', category: 'Vegetables', calories: 37, proteinG: 2.1, carbsG: 8.5, fatsG: 0.2, fiberG: 3.7, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Fenugreek Leaves (Methi)', category: 'Vegetables', calories: 49, proteinG: 4.4, carbsG: 6.0, fatsG: 0.9, fiberG: 2.7, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Brinjal / Eggplant (Baingan)', category: 'Vegetables', calories: 25, proteinG: 1.0, carbsG: 5.9, fatsG: 0.2, fiberG: 3.0, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Ladies Finger (Okra / Bhindi)', category: 'Vegetables', calories: 33, proteinG: 2.0, carbsG: 7.5, fatsG: 0.1, fiberG: 3.2, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Radish (Mooli)', category: 'Vegetables', calories: 16, proteinG: 0.7, carbsG: 3.4, fatsG: 0.1, fiberG: 1.6, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Mushroom (Button)', category: 'Vegetables', calories: 22, proteinG: 3.1, carbsG: 3.3, fatsG: 0.3, fiberG: 1.0, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Coriander Leaves (Dhania)', category: 'Vegetables', calories: 23, proteinG: 2.1, carbsG: 3.7, fatsG: 0.5, fiberG: 2.8, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Ginger', category: 'Vegetables', calories: 80, proteinG: 1.8, carbsG: 17.8, fatsG: 0.8, fiberG: 2.0, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Green Chilli', category: 'Vegetables', calories: 40, proteinG: 2.0, carbsG: 9.5, fatsG: 0.2, fiberG: 1.5, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Lettuce', category: 'Vegetables', calories: 15, proteinG: 1.4, carbsG: 2.9, fatsG: 0.2, fiberG: 1.3, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Spring Onion / Scallion', category: 'Vegetables', calories: 32, proteinG: 1.8, carbsG: 7.3, fatsG: 0.2, fiberG: 2.6, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Zucchini', category: 'Vegetables', calories: 17, proteinG: 1.2, carbsG: 3.1, fatsG: 0.3, fiberG: 1.0, allergenFlags: [], dietaryCategory: 'vegan' },

    // ─── Fruits ───────────────────────────────────────────────────────────────
    { name: 'Banana', category: 'Fruits', calories: 89, proteinG: 1.1, carbsG: 22.8, fatsG: 0.3, fiberG: 2.6, sugarG: 12.2, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Apple', category: 'Fruits', calories: 52, proteinG: 0.3, carbsG: 13.8, fatsG: 0.2, fiberG: 2.4, sugarG: 10.4, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Mango', category: 'Fruits', calories: 60, proteinG: 0.8, carbsG: 15.0, fatsG: 0.4, fiberG: 1.6, sugarG: 13.7, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Papaya', category: 'Fruits', calories: 43, proteinG: 0.5, carbsG: 10.8, fatsG: 0.3, fiberG: 1.7, sugarG: 7.8, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Guava', category: 'Fruits', calories: 68, proteinG: 2.6, carbsG: 14.3, fatsG: 0.9, fiberG: 5.4, sugarG: 8.9, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Orange', category: 'Fruits', calories: 47, proteinG: 0.9, carbsG: 11.8, fatsG: 0.1, fiberG: 2.4, sugarG: 9.4, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Watermelon', category: 'Fruits', calories: 30, proteinG: 0.6, carbsG: 7.6, fatsG: 0.2, fiberG: 0.4, sugarG: 6.2, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Grapes', category: 'Fruits', calories: 69, proteinG: 0.7, carbsG: 18.1, fatsG: 0.2, fiberG: 0.9, sugarG: 15.5, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Pomegranate', category: 'Fruits', calories: 83, proteinG: 1.7, carbsG: 18.7, fatsG: 1.2, fiberG: 4.0, sugarG: 13.7, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Pineapple', category: 'Fruits', calories: 50, proteinG: 0.5, carbsG: 13.1, fatsG: 0.1, fiberG: 1.4, sugarG: 9.9, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Pear', category: 'Fruits', calories: 57, proteinG: 0.4, carbsG: 15.2, fatsG: 0.1, fiberG: 3.1, sugarG: 9.8, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Strawberry', category: 'Fruits', calories: 32, proteinG: 0.7, carbsG: 7.7, fatsG: 0.3, fiberG: 2.0, sugarG: 4.9, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Kiwi', category: 'Fruits', calories: 61, proteinG: 1.1, carbsG: 14.7, fatsG: 0.5, fiberG: 3.0, sugarG: 9.0, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Litchi', category: 'Fruits', calories: 66, proteinG: 0.8, carbsG: 16.5, fatsG: 0.4, fiberG: 1.3, sugarG: 15.2, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Chiku (Sapodilla)', category: 'Fruits', calories: 83, proteinG: 0.4, carbsG: 20.0, fatsG: 1.1, fiberG: 5.3, sugarG: 12.0, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Jackfruit (Raw)', category: 'Fruits', calories: 95, proteinG: 1.7, carbsG: 23.2, fatsG: 0.6, fiberG: 1.5, sugarG: 19.1, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Lemon', category: 'Fruits', calories: 29, proteinG: 1.1, carbsG: 9.3, fatsG: 0.3, fiberG: 2.8, sugarG: 2.5, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Avocado', category: 'Fruits', calories: 160, proteinG: 2.0, carbsG: 8.5, fatsG: 14.7, fiberG: 6.7, sugarG: 0.7, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Amla (Indian Gooseberry)', category: 'Fruits', calories: 44, proteinG: 0.9, carbsG: 10.2, fatsG: 0.6, fiberG: 4.3, sugarG: 0, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Coconut (Fresh)', category: 'Fruits', calories: 354, proteinG: 3.3, carbsG: 15.2, fatsG: 33.5, fiberG: 9.0, allergenFlags: [], dietaryCategory: 'vegan' },

    // ─── Oils ─────────────────────────────────────────────────────────────────
    { name: 'Olive Oil', category: 'Oils', calories: 884, proteinG: 0, carbsG: 0, fatsG: 100, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Coconut Oil', category: 'Oils', calories: 862, proteinG: 0, carbsG: 0, fatsG: 100, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Sunflower Oil', category: 'Oils', calories: 884, proteinG: 0, carbsG: 0, fatsG: 100, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Mustard Oil', category: 'Oils', calories: 884, proteinG: 0, carbsG: 0, fatsG: 100, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Groundnut Oil', category: 'Oils', calories: 884, proteinG: 0, carbsG: 0, fatsG: 100, allergenFlags: ['peanuts'], dietaryCategory: 'vegan' },
    { name: 'Soybean Oil', category: 'Oils', calories: 884, proteinG: 0, carbsG: 0, fatsG: 100, allergenFlags: ['soy'], dietaryCategory: 'vegan' },

    // ─── Tofu & Soy ───────────────────────────────────────────────────────────
    { name: 'Tofu (Firm)', category: 'Proteins', calories: 76, proteinG: 8.1, carbsG: 1.9, fatsG: 4.8, allergenFlags: ['soy'], dietaryCategory: 'vegan' },
    { name: 'Tempeh', category: 'Proteins', calories: 193, proteinG: 19.0, carbsG: 7.6, fatsG: 10.8, allergenFlags: ['soy'], dietaryCategory: 'vegan' },
    { name: 'Soy Milk', category: 'Dairy', calories: 54, proteinG: 3.3, carbsG: 6.3, fatsG: 1.8, allergenFlags: ['soy'], dietaryCategory: 'vegan' },

    // ─── Beverages (base) ─────────────────────────────────────────────────────
    { name: 'Coconut Water', category: 'Beverages', calories: 19, proteinG: 0.7, carbsG: 4.0, fatsG: 0.2, sugarG: 2.6, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Lemon Juice (Fresh)', category: 'Beverages', calories: 22, proteinG: 0.4, carbsG: 6.9, fatsG: 0.2, allergenFlags: [], dietaryCategory: 'vegan' },

    // ─── Condiments & Basics ──────────────────────────────────────────────────
    { name: 'Sugar (White)', category: 'Other', calories: 387, proteinG: 0, carbsG: 100, fatsG: 0, sugarG: 100, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Honey', category: 'Other', calories: 304, proteinG: 0.3, carbsG: 82.4, fatsG: 0, sugarG: 82.1, allergenFlags: [], dietaryCategory: 'vegetarian' },
    { name: 'Salt', category: 'Other', calories: 0, proteinG: 0, carbsG: 0, fatsG: 0, sodiumMg: 38758, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Tamarind', category: 'Other', calories: 239, proteinG: 2.8, carbsG: 62.5, fatsG: 0.6, fiberG: 5.1, allergenFlags: [], dietaryCategory: 'vegan' },
    { name: 'Jaggery (Gur)', category: 'Other', calories: 375, proteinG: 0.4, carbsG: 97.0, fatsG: 0.1, sugarG: 88.0, allergenFlags: [], dietaryCategory: 'vegan' },
];

async function main() {
    console.log('🌱 Seeding base ingredients...\n');

    let created = 0;
    let skipped = 0;

    for (const item of BASE_INGREDIENTS) {
        const existing = await prisma.foodItem.findFirst({
            where: { name: item.name, orgId: null, isBaseIngredient: true },
        });

        if (existing) {
            console.log(`⏭️  Skipped (exists): ${item.name}`);
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
                fiberG: item.fiberG,
                sugarG: item.sugarG,
                sodiumMg: item.sodiumMg,
                allergenFlags: item.allergenFlags,
                dietaryTags: [],
                dietaryCategory: item.dietaryCategory,
                isBaseIngredient: true,
                isVerified: true,
                source: 'seed',
            },
        });
        console.log(`✅ Created: ${item.name}`);
        created++;
    }

    console.log(`\n📊 Done! Created: ${created}, Skipped: ${skipped}`);
}

main()
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
