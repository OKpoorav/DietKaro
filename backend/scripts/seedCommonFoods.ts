/**
 * Seed script for common Indian prepared foods/dishes.
 * All values per 100g (cooked/as-served). Source: USDA + NIN India (ICMR).
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
    /** Names of base ingredient FoodItems to link (must already exist from seed-ingredients.ts) */
    ingredientNames?: string[];
}

const COMMON_FOODS: FoodSeed[] = [

    // ─── Breakfast ────────────────────────────────────────────────────────────
    { name: 'Idli', category: 'Breakfast', calories: 39, proteinG: 1.5, carbsG: 8.0, fatsG: 0.2, fiberG: 0.3, dietaryCategory: 'vegetarian', ingredientNames: ['Rice', 'Urad Dal (Black Gram Split)'] },
    { name: 'Dosa (Plain)', category: 'Breakfast', calories: 89, proteinG: 2.0, carbsG: 12.0, fatsG: 3.5, fiberG: 0.5, dietaryCategory: 'vegetarian', ingredientNames: ['Rice', 'Urad Dal (Black Gram Split)'] },
    { name: 'Masala Dosa', category: 'Breakfast', calories: 175, proteinG: 4.0, carbsG: 22.0, fatsG: 7.5, fiberG: 1.5, dietaryCategory: 'vegetarian', ingredientNames: ['Rice', 'Urad Dal (Black Gram Split)', 'Potato', 'Onion'] },
    { name: 'Upma', category: 'Breakfast', calories: 110, proteinG: 3.0, carbsG: 17.0, fatsG: 3.5, fiberG: 1.0, dietaryCategory: 'vegetarian', ingredientNames: ['Semolina (Sooji / Rava)', 'Onion'] },
    { name: 'Poha', category: 'Breakfast', calories: 130, proteinG: 2.5, carbsG: 20.0, fatsG: 4.0, fiberG: 1.0, dietaryCategory: 'vegetarian', ingredientNames: ['Poha (Flattened Rice)', 'Onion', 'Green Peas (Fresh)'] },
    { name: 'Paratha (Plain)', category: 'Breakfast', calories: 260, proteinG: 5.0, carbsG: 32.0, fatsG: 12.0, fiberG: 2.0, dietaryCategory: 'vegetarian', ingredientNames: ['Wheat Flour (Atta)', 'Ghee'] },
    { name: 'Aloo Paratha', category: 'Breakfast', calories: 280, proteinG: 6.0, carbsG: 35.0, fatsG: 13.0, fiberG: 2.5, dietaryCategory: 'vegetarian', ingredientNames: ['Wheat Flour (Atta)', 'Potato', 'Ghee'] },
    { name: 'Methi Paratha', category: 'Breakfast', calories: 255, proteinG: 6.5, carbsG: 31.0, fatsG: 11.0, fiberG: 3.5, dietaryCategory: 'vegetarian', ingredientNames: ['Wheat Flour (Atta)', 'Fenugreek Leaves (Methi)', 'Ghee'] },
    { name: 'Cheela (Besan)', category: 'Breakfast', calories: 180, proteinG: 7.0, carbsG: 18.0, fatsG: 8.0, fiberG: 3.0, dietaryCategory: 'vegetarian', ingredientNames: ['Besan (Chickpea Flour)', 'Onion', 'Tomato'] },
    { name: 'Egg Omelette', category: 'Breakfast', calories: 154, proteinG: 11.0, carbsG: 1.0, fatsG: 12.0, dietaryCategory: 'non_veg', ingredientNames: ['Egg (Whole)', 'Onion', 'Tomato'] },
    { name: 'Boiled Eggs (2)', category: 'Breakfast', calories: 155, proteinG: 13.0, carbsG: 1.1, fatsG: 11.0, dietaryCategory: 'non_veg', ingredientNames: ['Egg (Whole)'] },
    { name: 'Scrambled Eggs', category: 'Breakfast', calories: 150, proteinG: 10.0, carbsG: 1.5, fatsG: 11.5, dietaryCategory: 'non_veg', ingredientNames: ['Egg (Whole)', 'Milk (Whole)', 'Butter'] },
    { name: 'Oatmeal / Daliya (Cooked)', category: 'Breakfast', calories: 71, proteinG: 2.5, carbsG: 12.0, fatsG: 1.5, fiberG: 1.7, dietaryCategory: 'vegetarian', ingredientNames: ['Oats (Rolled)', 'Milk (Whole)'] },
    { name: 'Pesarattu (Green Moong Dosa)', category: 'Breakfast', calories: 98, proteinG: 5.2, carbsG: 13.5, fatsG: 2.8, fiberG: 2.0, dietaryCategory: 'vegetarian', ingredientNames: ['Moong Beans (Whole Green)'] },
    { name: 'Uttapam', category: 'Breakfast', calories: 110, proteinG: 3.5, carbsG: 16.0, fatsG: 3.0, fiberG: 1.0, dietaryCategory: 'vegetarian', ingredientNames: ['Rice', 'Urad Dal (Black Gram Split)', 'Onion', 'Tomato'] },
    { name: 'Pongal (Sweet)', category: 'Breakfast', calories: 150, proteinG: 3.0, carbsG: 28.0, fatsG: 3.0, fiberG: 0.5, dietaryCategory: 'vegetarian', ingredientNames: ['White Rice (Raw)', 'Moong Dal (Yellow)', 'Jaggery (Gur)', 'Ghee'] },
    { name: 'Khichdi', category: 'Breakfast', calories: 120, proteinG: 4.5, carbsG: 20.0, fatsG: 2.5, fiberG: 1.5, dietaryCategory: 'vegetarian', ingredientNames: ['White Rice (Raw)', 'Moong Dal (Yellow)', 'Ghee'] },
    { name: 'Bread Toast (Butter)', category: 'Breakfast', calories: 320, proteinG: 8.5, carbsG: 42.0, fatsG: 13.0, fiberG: 2.0, dietaryCategory: 'vegetarian', ingredientNames: ['Bread (White)', 'Butter'] },

    // ─── Rice & Grains ────────────────────────────────────────────────────────
    { name: 'White Rice (Cooked)', category: 'Grains', calories: 130, proteinG: 2.7, carbsG: 28.0, fatsG: 0.3, fiberG: 0.4, dietaryCategory: 'vegetarian', ingredientNames: ['White Rice (Raw)'] },
    { name: 'Brown Rice (Cooked)', category: 'Grains', calories: 111, proteinG: 2.6, carbsG: 23.0, fatsG: 0.9, fiberG: 1.8, dietaryCategory: 'vegetarian', ingredientNames: ['Brown Rice (Raw)'] },
    { name: 'Chapati / Roti (Wheat)', category: 'Grains', calories: 71, proteinG: 2.7, carbsG: 15.0, fatsG: 0.4, fiberG: 1.9, dietaryCategory: 'vegetarian', ingredientNames: ['Wheat Flour (Atta)'] },
    { name: 'Phulka (Oil-free Roti)', category: 'Grains', calories: 65, proteinG: 2.5, carbsG: 14.0, fatsG: 0.1, fiberG: 1.8, dietaryCategory: 'vegan', ingredientNames: ['Wheat Flour (Atta)'] },
    { name: 'Bajra Roti', category: 'Grains', calories: 97, proteinG: 3.0, carbsG: 18.0, fatsG: 1.8, fiberG: 3.5, dietaryCategory: 'vegan', ingredientNames: ['Bajra (Pearl Millet)'] },
    { name: 'Jowar Roti', category: 'Grains', calories: 90, proteinG: 2.8, carbsG: 18.0, fatsG: 1.0, fiberG: 2.5, dietaryCategory: 'vegan', ingredientNames: ['Jowar (Sorghum)'] },
    { name: 'Ragi Roti', category: 'Grains', calories: 85, proteinG: 2.0, carbsG: 17.5, fatsG: 0.5, fiberG: 1.5, dietaryCategory: 'vegan', ingredientNames: ['Ragi (Finger Millet)'] },
    { name: 'Naan', category: 'Grains', calories: 262, proteinG: 8.0, carbsG: 45.0, fatsG: 5.0, fiberG: 2.0, dietaryCategory: 'vegetarian', ingredientNames: ['Maida (Refined Flour)', 'Curd / Yogurt'] },
    { name: 'Jeera Rice', category: 'Grains', calories: 150, proteinG: 3.0, carbsG: 30.0, fatsG: 2.0, fiberG: 0.5, dietaryCategory: 'vegetarian', ingredientNames: ['White Rice (Raw)', 'Ghee'] },
    { name: 'Vegetable Pulao', category: 'Grains', calories: 160, proteinG: 3.5, carbsG: 30.0, fatsG: 4.0, fiberG: 2.0, dietaryCategory: 'vegetarian', ingredientNames: ['White Rice (Raw)', 'Carrot', 'Green Peas (Fresh)', 'Ghee'] },
    { name: 'Quinoa (Cooked)', category: 'Grains', calories: 120, proteinG: 4.4, carbsG: 21.3, fatsG: 1.9, fiberG: 2.8, dietaryCategory: 'vegan', ingredientNames: ['Quinoa (Raw)'] },

    // ─── Dals & Legumes ───────────────────────────────────────────────────────
    { name: 'Dal Tadka', category: 'Legumes', calories: 116, proteinG: 6.5, carbsG: 16.0, fatsG: 3.0, fiberG: 4.0, dietaryCategory: 'vegetarian', ingredientNames: ['Toor Dal (Pigeon Pea)', 'Onion', 'Tomato', 'Ghee'] },
    { name: 'Dal Makhani', category: 'Legumes', calories: 180, proteinG: 7.0, carbsG: 20.0, fatsG: 8.0, fiberG: 5.0, dietaryCategory: 'vegetarian', ingredientNames: ['Urad Dal (Black Gram Split)', 'Kala Chana (Black Chickpea)', 'Butter', 'Cream'] },
    { name: 'Chana Masala', category: 'Legumes', calories: 180, proteinG: 8.5, carbsG: 26.0, fatsG: 4.5, fiberG: 6.0, dietaryCategory: 'vegetarian', ingredientNames: ['Kabuli Chana (White Chickpea)', 'Onion', 'Tomato'] },
    { name: 'Rajma (Cooked)', category: 'Legumes', calories: 140, proteinG: 7.0, carbsG: 22.0, fatsG: 2.5, fiberG: 5.0, dietaryCategory: 'vegetarian', ingredientNames: ['Rajma (Kidney Beans, Dry)', 'Onion', 'Tomato'] },
    { name: 'Sambhar', category: 'Legumes', calories: 65, proteinG: 3.0, carbsG: 10.0, fatsG: 1.5, fiberG: 2.5, dietaryCategory: 'vegetarian', ingredientNames: ['Toor Dal (Pigeon Pea)', 'Tomato', 'Drumstick (Moringa Pods)'] },
    { name: 'Moong Dal (Cooked)', category: 'Legumes', calories: 104, proteinG: 7.0, carbsG: 15.0, fatsG: 1.5, fiberG: 4.0, dietaryCategory: 'vegetarian', ingredientNames: ['Moong Dal (Yellow)', 'Ghee'] },
    { name: 'Masoor Dal (Cooked)', category: 'Legumes', calories: 116, proteinG: 9.0, carbsG: 16.0, fatsG: 0.4, fiberG: 3.5, dietaryCategory: 'vegan', ingredientNames: ['Masoor Dal (Red Lentil)'] },
    { name: 'Chole Bhature', category: 'Legumes', calories: 280, proteinG: 8.0, carbsG: 36.0, fatsG: 11.0, fiberG: 4.5, dietaryCategory: 'vegetarian', ingredientNames: ['Kabuli Chana (White Chickpea)', 'Maida (Refined Flour)', 'Onion', 'Tomato'] },
    { name: 'Moong Sprouts (Boiled)', category: 'Legumes', calories: 105, proteinG: 7.0, carbsG: 19.0, fatsG: 0.4, fiberG: 1.8, dietaryCategory: 'vegan', ingredientNames: ['Moong Beans (Whole Green)'] },

    // ─── Vegetables (Cooked) ──────────────────────────────────────────────────
    { name: 'Aloo Gobi', category: 'Vegetables', calories: 90, proteinG: 2.0, carbsG: 12.0, fatsG: 4.0, fiberG: 2.5, dietaryCategory: 'vegetarian', ingredientNames: ['Potato', 'Cauliflower', 'Onion', 'Tomato'] },
    { name: 'Bhindi Masala', category: 'Vegetables', calories: 85, proteinG: 2.5, carbsG: 8.0, fatsG: 5.0, fiberG: 3.0, dietaryCategory: 'vegetarian', ingredientNames: ['Ladies Finger (Okra / Bhindi)', 'Onion', 'Tomato'] },
    { name: 'Palak Paneer', category: 'Vegetables', calories: 200, proteinG: 10.0, carbsG: 8.0, fatsG: 15.0, fiberG: 2.0, dietaryCategory: 'vegetarian', ingredientNames: ['Spinach (Palak)', 'Paneer', 'Cream'] },
    { name: 'Paneer Butter Masala', category: 'Vegetables', calories: 280, proteinG: 12.0, carbsG: 10.0, fatsG: 22.0, fiberG: 1.0, dietaryCategory: 'vegetarian', ingredientNames: ['Paneer', 'Tomato', 'Cream', 'Butter'] },
    { name: 'Mixed Veg Curry', category: 'Vegetables', calories: 100, proteinG: 3.0, carbsG: 12.0, fatsG: 4.5, fiberG: 3.0, dietaryCategory: 'vegetarian', ingredientNames: ['Carrot', 'Cauliflower', 'Green Peas (Fresh)', 'Potato'] },
    { name: 'Baingan Bharta', category: 'Vegetables', calories: 110, proteinG: 2.0, carbsG: 10.0, fatsG: 7.0, fiberG: 3.0, dietaryCategory: 'vegetarian', ingredientNames: ['Brinjal / Eggplant (Baingan)', 'Onion', 'Tomato'] },
    { name: 'Saag (Sarson da Saag)', category: 'Vegetables', calories: 95, proteinG: 4.0, carbsG: 10.0, fatsG: 5.0, fiberG: 4.5, dietaryCategory: 'vegetarian', ingredientNames: ['Spinach (Palak)', 'Fenugreek Leaves (Methi)', 'Corn Flour (Makki Atta)', 'Ghee'] },
    { name: 'Lauki Sabzi', category: 'Vegetables', calories: 55, proteinG: 1.0, carbsG: 8.0, fatsG: 2.5, fiberG: 1.5, dietaryCategory: 'vegetarian', ingredientNames: ['Bottle Gourd (Lauki)', 'Onion', 'Tomato'] },
    { name: 'Karela Sabzi', category: 'Vegetables', calories: 70, proteinG: 1.5, carbsG: 9.0, fatsG: 3.5, fiberG: 3.5, dietaryCategory: 'vegetarian', ingredientNames: ['Bitter Gourd (Karela)', 'Onion'] },
    { name: 'Aloo Matar', category: 'Vegetables', calories: 105, proteinG: 3.0, carbsG: 15.0, fatsG: 4.0, fiberG: 3.0, dietaryCategory: 'vegetarian', ingredientNames: ['Potato', 'Green Peas (Fresh)', 'Onion', 'Tomato'] },
    { name: 'Mushroom Masala', category: 'Vegetables', calories: 95, proteinG: 4.0, carbsG: 8.0, fatsG: 5.5, fiberG: 1.5, dietaryCategory: 'vegetarian', ingredientNames: ['Mushroom (Button)', 'Onion', 'Tomato', 'Cream'] },
    { name: 'Tofu Bhurji', category: 'Vegetables', calories: 130, proteinG: 10.0, carbsG: 5.0, fatsG: 8.0, fiberG: 1.5, dietaryCategory: 'vegan', ingredientNames: ['Tofu (Firm)', 'Onion', 'Tomato', 'Capsicum / Bell Pepper (Green)'] },

    // ─── Non-Veg Curries & Dishes ─────────────────────────────────────────────
    { name: 'Butter Chicken', category: 'Non-Veg', calories: 245, proteinG: 16.0, carbsG: 6.0, fatsG: 18.0, dietaryCategory: 'non_veg', ingredientNames: ['Chicken Breast (Boneless, Raw)', 'Tomato', 'Cream', 'Butter'] },
    { name: 'Chicken Curry', category: 'Non-Veg', calories: 180, proteinG: 18.0, carbsG: 4.0, fatsG: 10.0, dietaryCategory: 'non_veg', ingredientNames: ['Chicken (Whole, Raw)', 'Onion', 'Tomato'] },
    { name: 'Chicken Tikka Masala', category: 'Non-Veg', calories: 210, proteinG: 19.0, carbsG: 7.0, fatsG: 12.0, dietaryCategory: 'non_veg', ingredientNames: ['Chicken Breast (Boneless, Raw)', 'Curd / Yogurt', 'Onion', 'Tomato', 'Cream'] },
    { name: 'Tandoori Chicken', category: 'Non-Veg', calories: 165, proteinG: 25.0, carbsG: 3.0, fatsG: 6.0, dietaryCategory: 'non_veg', ingredientNames: ['Chicken (Whole, Raw)', 'Curd / Yogurt'] },
    { name: 'Chicken Biryani', category: 'Non-Veg', calories: 190, proteinG: 8.0, carbsG: 25.0, fatsG: 6.0, dietaryCategory: 'non_veg', ingredientNames: ['White Rice (Raw)', 'Chicken (Whole, Raw)', 'Onion', 'Ghee'] },
    { name: 'Mutton Curry', category: 'Non-Veg', calories: 250, proteinG: 20.0, carbsG: 5.0, fatsG: 17.0, dietaryCategory: 'non_veg', ingredientNames: ['Mutton / Lamb (Raw)', 'Onion', 'Tomato'] },
    { name: 'Fish Curry', category: 'Non-Veg', calories: 135, proteinG: 18.0, carbsG: 3.0, fatsG: 5.5, dietaryCategory: 'non_veg', ingredientNames: ['Rohu Fish', 'Onion', 'Tomato', 'Coconut Oil'] },
    { name: 'Egg Curry', category: 'Non-Veg', calories: 150, proteinG: 10.0, carbsG: 5.0, fatsG: 10.0, dietaryCategory: 'non_veg', ingredientNames: ['Egg (Whole)', 'Onion', 'Tomato'] },
    { name: 'Prawn Masala', category: 'Non-Veg', calories: 140, proteinG: 18.0, carbsG: 4.0, fatsG: 6.0, dietaryCategory: 'non_veg', ingredientNames: ['Prawns / Shrimp', 'Onion', 'Tomato', 'Coconut Oil'] },
    { name: 'Keema Matar', category: 'Non-Veg', calories: 220, proteinG: 18.0, carbsG: 8.0, fatsG: 14.0, dietaryCategory: 'non_veg', ingredientNames: ['Mutton / Lamb (Raw)', 'Green Peas (Fresh)', 'Onion', 'Tomato'] },
    { name: 'Chicken Keema', category: 'Non-Veg', calories: 195, proteinG: 20.0, carbsG: 4.0, fatsG: 11.0, dietaryCategory: 'non_veg', ingredientNames: ['Chicken (Whole, Raw)', 'Onion', 'Tomato'] },

    // ─── Snacks ───────────────────────────────────────────────────────────────
    { name: 'Samosa (1 pc)', category: 'Snacks', calories: 260, proteinG: 4.0, carbsG: 30.0, fatsG: 14.0, fiberG: 2.0, dietaryCategory: 'vegetarian', ingredientNames: ['Maida (Refined Flour)', 'Potato', 'Green Peas (Fresh)'] },
    { name: 'Pakora (Mixed)', category: 'Snacks', calories: 240, proteinG: 6.0, carbsG: 20.0, fatsG: 15.0, fiberG: 2.0, dietaryCategory: 'vegetarian', ingredientNames: ['Besan (Chickpea Flour)', 'Onion', 'Spinach (Palak)'] },
    { name: 'Vada Pav', category: 'Snacks', calories: 290, proteinG: 5.0, carbsG: 35.0, fatsG: 14.0, dietaryCategory: 'vegetarian', ingredientNames: ['Potato', 'Besan (Chickpea Flour)', 'Bread (White)'] },
    { name: 'Pav Bhaji', category: 'Snacks', calories: 320, proteinG: 6.0, carbsG: 40.0, fatsG: 15.0, fiberG: 4.0, dietaryCategory: 'vegetarian', ingredientNames: ['Potato', 'Cauliflower', 'Green Peas (Fresh)', 'Butter', 'Bread (White)'] },
    { name: 'Bhel Puri', category: 'Snacks', calories: 150, proteinG: 3.0, carbsG: 25.0, fatsG: 4.0, fiberG: 2.0, dietaryCategory: 'vegetarian', ingredientNames: ['Poha (Flattened Rice)', 'Onion', 'Tomato', 'Peanuts'] },
    { name: 'Dhokla', category: 'Snacks', calories: 180, proteinG: 8.0, carbsG: 30.0, fatsG: 3.5, fiberG: 1.5, dietaryCategory: 'vegetarian', ingredientNames: ['Besan (Chickpea Flour)', 'Curd / Yogurt'] },
    { name: 'Pani Puri / Golgappa', category: 'Snacks', calories: 200, proteinG: 4.5, carbsG: 35.0, fatsG: 5.5, fiberG: 2.0, dietaryCategory: 'vegan', ingredientNames: ['Maida (Refined Flour)', 'Potato'] },
    { name: 'Kachori', category: 'Snacks', calories: 390, proteinG: 8.0, carbsG: 45.0, fatsG: 20.0, fiberG: 3.0, dietaryCategory: 'vegetarian', ingredientNames: ['Maida (Refined Flour)', 'Moong Dal (Yellow)'] },
    { name: 'Chivda (Poha Mix)', category: 'Snacks', calories: 420, proteinG: 10.0, carbsG: 55.0, fatsG: 18.0, fiberG: 2.5, dietaryCategory: 'vegetarian', ingredientNames: ['Poha (Flattened Rice)', 'Peanuts', 'Cashews'] },

    // ─── Dairy & Protein ──────────────────────────────────────────────────────
    { name: 'Curd (Dahi)', category: 'Dairy', calories: 60, proteinG: 3.4, carbsG: 5.0, fatsG: 3.3, dietaryCategory: 'vegetarian', ingredientNames: ['Milk (Whole)'] },
    { name: 'Paneer (Plain, Raw)', category: 'Dairy', calories: 265, proteinG: 18.0, carbsG: 2.0, fatsG: 21.0, dietaryCategory: 'vegetarian', ingredientNames: ['Milk (Whole)'] },
    { name: 'Lassi (Sweet)', category: 'Dairy', calories: 100, proteinG: 3.0, carbsG: 18.0, fatsG: 2.0, sugarG: 15.0, dietaryCategory: 'vegetarian', ingredientNames: ['Curd / Yogurt', 'Sugar (White)'] },
    { name: 'Lassi (Salted)', category: 'Dairy', calories: 60, proteinG: 3.0, carbsG: 6.0, fatsG: 2.0, sodiumMg: 300, dietaryCategory: 'vegetarian', ingredientNames: ['Curd / Yogurt', 'Salt'] },
    { name: 'Buttermilk (Chaas)', category: 'Dairy', calories: 25, proteinG: 2.0, carbsG: 3.0, fatsG: 0.5, dietaryCategory: 'vegetarian', ingredientNames: ['Curd / Yogurt'] },
    { name: 'Raita (Mixed Veg)', category: 'Dairy', calories: 65, proteinG: 3.0, carbsG: 7.0, fatsG: 2.5, fiberG: 0.5, dietaryCategory: 'vegetarian', ingredientNames: ['Curd / Yogurt', 'Cucumber', 'Tomato', 'Onion'] },
    { name: 'Shrikhand', category: 'Dairy', calories: 215, proteinG: 6.0, carbsG: 35.0, fatsG: 6.0, sugarG: 30.0, dietaryCategory: 'vegetarian', ingredientNames: ['Curd / Yogurt', 'Sugar (White)'] },

    // ─── Sweets ───────────────────────────────────────────────────────────────
    { name: 'Gulab Jamun (1 pc)', category: 'Sweets', calories: 175, proteinG: 2.0, carbsG: 28.0, fatsG: 6.0, sugarG: 22.0, dietaryCategory: 'vegetarian', ingredientNames: ['Milk (Whole)', 'Maida (Refined Flour)', 'Sugar (White)'] },
    { name: 'Rasgulla (1 pc)', category: 'Sweets', calories: 120, proteinG: 3.0, carbsG: 22.0, fatsG: 2.0, sugarG: 18.0, dietaryCategory: 'vegetarian', ingredientNames: ['Milk (Whole)', 'Sugar (White)'] },
    { name: 'Kheer / Rice Pudding', category: 'Sweets', calories: 140, proteinG: 4.0, carbsG: 22.0, fatsG: 4.0, sugarG: 16.0, dietaryCategory: 'vegetarian', ingredientNames: ['Milk (Whole)', 'White Rice (Raw)', 'Sugar (White)'] },
    { name: 'Jalebi (2 pcs)', category: 'Sweets', calories: 180, proteinG: 1.0, carbsG: 35.0, fatsG: 4.0, sugarG: 28.0, dietaryCategory: 'vegetarian', ingredientNames: ['Maida (Refined Flour)', 'Sugar (White)'] },
    { name: 'Halwa (Suji)', category: 'Sweets', calories: 340, proteinG: 5.0, carbsG: 48.0, fatsG: 15.0, dietaryCategory: 'vegetarian', ingredientNames: ['Semolina (Sooji / Rava)', 'Ghee', 'Sugar (White)'] },
    { name: 'Ladoo (Besan)', category: 'Sweets', calories: 450, proteinG: 8.0, carbsG: 58.0, fatsG: 20.0, dietaryCategory: 'vegetarian', ingredientNames: ['Besan (Chickpea Flour)', 'Ghee', 'Sugar (White)'] },
    { name: 'Peda', category: 'Sweets', calories: 380, proteinG: 8.0, carbsG: 60.0, fatsG: 12.0, sugarG: 50.0, dietaryCategory: 'vegetarian', ingredientNames: ['Milk (Whole)', 'Sugar (White)', 'Ghee'] },

    // ─── Fruits ───────────────────────────────────────────────────────────────
    { name: 'Banana', category: 'Fruits', calories: 89, proteinG: 1.1, carbsG: 22.8, fatsG: 0.3, fiberG: 2.6, sugarG: 12.2, dietaryCategory: 'vegan' },
    { name: 'Apple', category: 'Fruits', calories: 52, proteinG: 0.3, carbsG: 13.8, fatsG: 0.2, fiberG: 2.4, sugarG: 10.4, dietaryCategory: 'vegan' },
    { name: 'Mango', category: 'Fruits', calories: 60, proteinG: 0.8, carbsG: 15.0, fatsG: 0.4, fiberG: 1.6, sugarG: 13.7, dietaryCategory: 'vegan' },
    { name: 'Papaya', category: 'Fruits', calories: 43, proteinG: 0.5, carbsG: 10.8, fatsG: 0.3, fiberG: 1.7, sugarG: 7.8, dietaryCategory: 'vegan' },
    { name: 'Guava', category: 'Fruits', calories: 68, proteinG: 2.6, carbsG: 14.3, fatsG: 0.9, fiberG: 5.4, sugarG: 8.9, dietaryCategory: 'vegan' },
    { name: 'Orange', category: 'Fruits', calories: 47, proteinG: 0.9, carbsG: 11.8, fatsG: 0.1, fiberG: 2.4, sugarG: 9.4, dietaryCategory: 'vegan' },
    { name: 'Watermelon', category: 'Fruits', calories: 30, proteinG: 0.6, carbsG: 7.6, fatsG: 0.2, fiberG: 0.4, sugarG: 6.2, dietaryCategory: 'vegan' },
    { name: 'Pomegranate', category: 'Fruits', calories: 83, proteinG: 1.7, carbsG: 18.7, fatsG: 1.2, fiberG: 4.0, sugarG: 13.7, dietaryCategory: 'vegan' },
    { name: 'Pineapple', category: 'Fruits', calories: 50, proteinG: 0.5, carbsG: 13.1, fatsG: 0.1, fiberG: 1.4, sugarG: 9.9, dietaryCategory: 'vegan' },
    { name: 'Grapes', category: 'Fruits', calories: 69, proteinG: 0.7, carbsG: 18.1, fatsG: 0.2, fiberG: 0.9, sugarG: 15.5, dietaryCategory: 'vegan' },
    { name: 'Strawberry', category: 'Fruits', calories: 32, proteinG: 0.7, carbsG: 7.7, fatsG: 0.3, fiberG: 2.0, sugarG: 4.9, dietaryCategory: 'vegan' },

    // ─── Beverages ────────────────────────────────────────────────────────────
    { name: 'Chai (Milk Tea with Sugar)', category: 'Beverages', calories: 65, proteinG: 2.0, carbsG: 10.0, fatsG: 2.0, sugarG: 8.0, dietaryCategory: 'vegetarian', ingredientNames: ['Milk (Whole)', 'Sugar (White)'] },
    { name: 'Black Tea (Plain)', category: 'Beverages', calories: 2, proteinG: 0, carbsG: 0.5, fatsG: 0, dietaryCategory: 'vegan' },
    { name: 'Coffee (with Milk)', category: 'Beverages', calories: 50, proteinG: 1.5, carbsG: 6.0, fatsG: 2.0, sugarG: 5.0, dietaryCategory: 'vegetarian', ingredientNames: ['Milk (Whole)', 'Sugar (White)'] },
    { name: 'Nimbu Pani / Lemonade', category: 'Beverages', calories: 40, proteinG: 0, carbsG: 10.0, fatsG: 0, sugarG: 8.0, dietaryCategory: 'vegan', ingredientNames: ['Lemon', 'Sugar (White)'] },
    { name: 'Coconut Water', category: 'Beverages', calories: 19, proteinG: 0.7, carbsG: 4.0, fatsG: 0.2, sugarG: 2.6, dietaryCategory: 'vegan' },
    { name: 'Turmeric Milk (Haldi Doodh)', category: 'Beverages', calories: 80, proteinG: 3.5, carbsG: 9.0, fatsG: 3.0, dietaryCategory: 'vegetarian', ingredientNames: ['Milk (Whole)', 'Honey'] },
    { name: 'Protein Shake (Whey + Milk)', category: 'Beverages', calories: 180, proteinG: 22.0, carbsG: 14.0, fatsG: 3.5, dietaryCategory: 'vegetarian', ingredientNames: ['Whey Protein', 'Milk (Skim/Toned)'] },
    { name: 'Green Smoothie (Spinach + Banana)', category: 'Beverages', calories: 95, proteinG: 2.5, carbsG: 20.0, fatsG: 0.8, fiberG: 3.0, dietaryCategory: 'vegan', ingredientNames: ['Spinach (Palak)', 'Banana', 'Coconut Water'] },
];

async function seedCommonFoods() {
    console.log('🌱 Starting prepared foods seed...\n');

    let created = 0;
    let skipped = 0;
    let linked = 0;

    for (const food of COMMON_FOODS) {
        const existing = await prisma.foodItem.findFirst({
            where: { name: { equals: food.name, mode: 'insensitive' }, orgId: null },
        });

        if (existing) {
            console.log(`⏭️  Skipped (exists): ${food.name}`);
            skipped++;
            continue;
        }

        const newFood = await prisma.foodItem.create({
            data: {
                orgId: null,
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
                source: 'seed_data',
            },
        });

        await foodTaggingService.autoTagFood(newFood.id);

        // Link to base ingredients
        if (food.ingredientNames && food.ingredientNames.length > 0) {
            for (const ingName of food.ingredientNames) {
                const ingredient = await prisma.foodItem.findFirst({
                    where: { name: ingName, orgId: null },
                    select: { id: true },
                });
                if (ingredient) {
                    await prisma.foodItemIngredient.create({
                        data: { foodItemId: newFood.id, ingredientId: ingredient.id },
                    });
                    linked++;
                }
            }
        }

        console.log(`✅ Created: ${food.name} (${food.dietaryCategory})`);
        created++;
    }

    console.log(`\n📊 Summary: Created ${created}, Skipped ${skipped}, Ingredient links ${linked}`);
    console.log('✅ Seed complete!');
}

seedCommonFoods()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
