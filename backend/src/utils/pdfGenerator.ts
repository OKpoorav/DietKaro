import PDFDocument from 'pdfkit';
import { DietPlan, Meal, MealFoodItem, FoodItem, Client } from '@prisma/client';
import { escapeHtml } from './htmlEscape';

type MealWithFoodItems = Meal & {
    foodItems: (MealFoodItem & { foodItem: FoodItem })[];
};

type DietPlanWithRelations = DietPlan & {
    client: Pick<Client, 'fullName' | 'currentWeightKg' | 'targetWeightKg'> | null;
    meals: MealWithFoodItems[];
};

const COLORS = {
    primary: '#17cf54',
    dark: '#111827',
    gray: '#6b7280',
    lightGray: '#e5e7eb',
};

const MEAL_TYPE_LABELS: Record<string, string> = {
    breakfast: '🌅 Breakfast',
    lunch: '☀️ Lunch',
    snack: '🍎 Snack',
    dinner: '🌙 Dinner',
};

export function generateDietPlanPDF(plan: DietPlanWithRelations): PDFKit.PDFDocument {
    const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
            Title: `Diet Plan - ${plan.name}`,
            Author: 'DietKaro',
            Subject: 'Personalized Diet Plan',
        },
    });

    // Header
    doc.fontSize(24)
        .fillColor(COLORS.dark)
        .text(plan.name, { align: 'center' });

    if (plan.client?.fullName) {
        doc.fontSize(14)
            .fillColor(COLORS.gray)
            .text(`Prepared for: ${plan.client.fullName}`, { align: 'center' });
    }

    doc.moveDown();

    // Date Range
    const startDate = new Date(plan.startDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    const endDate = plan.endDate
        ? new Date(plan.endDate).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })
        : 'Ongoing';

    doc.fontSize(11)
        .fillColor(COLORS.gray)
        .text(`Duration: ${startDate} - ${endDate}`, { align: 'center' });

    doc.moveDown(2);

    // Nutritional Targets Card
    if (plan.targetCalories) {
        doc.rect(50, doc.y, 495, 80).fill('#f3f4f6');
        const boxY = doc.y + 15;

        doc.fillColor(COLORS.dark)
            .fontSize(12)
            .text('Daily Nutritional Targets', 60, boxY, { underline: true });

        const targetY = boxY + 25;
        const colWidth = 120;

        doc.fontSize(10).fillColor(COLORS.gray);
        doc.text(`Calories: ${plan.targetCalories || '-'} kcal`, 60, targetY);
        doc.text(`Protein: ${plan.targetProteinG || '-'} g`, 60 + colWidth, targetY);
        doc.text(`Carbs: ${plan.targetCarbsG || '-'} g`, 60 + colWidth * 2, targetY);
        doc.text(`Fats: ${plan.targetFatsG || '-'} g`, 60 + colWidth * 3, targetY);

        if (plan.targetFiberG) {
            doc.text(`Fiber: ${plan.targetFiberG} g`, 60, targetY + 20);
        }

        doc.y = boxY + 80;
    }

    doc.moveDown(2);

    // Group meals by day
    const mealsByDay = new Map<number, MealWithFoodItems[]>();
    plan.meals.forEach((meal) => {
        const day = meal.dayOfWeek ?? 0;
        if (!mealsByDay.has(day)) {
            mealsByDay.set(day, []);
        }
        mealsByDay.get(day)!.push(meal);
    });

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Meals by Day
    Array.from(mealsByDay.entries())
        .sort(([a], [b]) => a - b)
        .forEach(([dayIndex, meals]) => {
            // Day Header
            doc.fontSize(16)
                .fillColor(COLORS.dark)
                .text(dayNames[dayIndex] || `Day ${dayIndex + 1}`, { underline: true });

            doc.moveDown(0.5);

            // Sort meals by type
            const mealOrder = ['breakfast', 'lunch', 'snack', 'dinner'];
            meals
                .sort((a, b) => mealOrder.indexOf(a.mealType) - mealOrder.indexOf(b.mealType))
                .forEach((meal) => {
                    // Meal Header
                    doc.fontSize(13)
                        .fillColor(COLORS.primary)
                        .text(MEAL_TYPE_LABELS[meal.mealType] || meal.mealType);

                    if (meal.timeOfDay) {
                        doc.fontSize(10)
                            .fillColor(COLORS.gray)
                            .text(`Time: ${meal.timeOfDay}`);
                    }

                    doc.fontSize(12)
                        .fillColor(COLORS.dark)
                        .text(meal.name);

                    if (meal.description) {
                        doc.fontSize(10)
                            .fillColor(COLORS.gray)
                            .text(meal.description);
                    }

                    // Food Items — grouped by optionGroup
                    if (meal.foodItems.length > 0) {
                        doc.moveDown(0.3);

                        // Group food items by optionGroup
                        const optionGroups = new Map<number, typeof meal.foodItems>();
                        meal.foodItems.forEach((item) => {
                            const group = (item as any).optionGroup ?? 0;
                            if (!optionGroups.has(group)) optionGroups.set(group, []);
                            optionGroups.get(group)!.push(item);
                        });

                        const sortedGroups = Array.from(optionGroups.entries()).sort(([a], [b]) => a - b);
                        const hasAlternatives = sortedGroups.length > 1;

                        sortedGroups.forEach(([groupNum, items], groupIndex) => {
                            if (hasAlternatives) {
                                const label = (items[0] as any).optionLabel || `Option ${String.fromCharCode(65 + groupNum)}`;
                                doc.fontSize(10)
                                    .fillColor(COLORS.primary)
                                    .text(`  ${label}:`);
                            }

                            items.forEach((item) => {
                                const foodName = item.foodItem?.name || 'Unknown food';
                                const quantity = item.quantityG ? `${item.quantityG}g` : '';
                                const calories = item.foodItem?.calories
                                    ? `${Math.round((item.foodItem.calories * (Number(item.quantityG) || 100)) / 100)} kcal`
                                    : '';

                                doc.fontSize(10)
                                    .fillColor(COLORS.dark)
                                    .text(`    • ${foodName} ${quantity}`, {
                                        continued: !!calories,
                                    });

                                if (calories) {
                                    doc.fillColor(COLORS.gray).text(` — ${calories}`);
                                }
                            });

                            // OR divider between option groups
                            if (hasAlternatives && groupIndex < sortedGroups.length - 1) {
                                doc.moveDown(0.2)
                                    .fontSize(9)
                                    .fillColor(COLORS.gray)
                                    .text('                         — OR —', { align: 'left' })
                                    .moveDown(0.2);
                            }
                        });
                    }

                    // Instructions
                    if (meal.instructions) {
                        doc.moveDown(0.3)
                            .fontSize(9)
                            .fillColor(COLORS.gray)
                            .text(`📝 ${meal.instructions}`);
                    }

                    doc.moveDown();
                });

            doc.moveDown();

            // Page break check
            if (doc.y > 700) {
                doc.addPage();
            }
        });

    // Notes for Client
    if (plan.notesForClient) {
        doc.addPage();
        doc.fontSize(16)
            .fillColor(COLORS.dark)
            .text('Notes & Guidelines', { underline: true });

        doc.moveDown()
            .fontSize(11)
            .fillColor(COLORS.gray)
            .text(plan.notesForClient, { align: 'left', lineGap: 4 });
    }

    // Footer on last page
    doc.fontSize(8)
        .fillColor(COLORS.lightGray)
        .text(
            `Generated by DietKaro on ${new Date().toLocaleDateString('en-IN')}`,
            50,
            780,
            { align: 'center', width: 495 }
        );

    return doc;
}

export function generateMealPlanPrintHtml(plan: DietPlanWithRelations): string {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Group meals by day
    const mealsByDay = new Map<number, MealWithFoodItems[]>();
    plan.meals.forEach((meal) => {
        const day = meal.dayOfWeek ?? 0;
        if (!mealsByDay.has(day)) {
            mealsByDay.set(day, []);
        }
        mealsByDay.get(day)!.push(meal);
    });

    const mealOrder = ['breakfast', 'lunch', 'snack', 'dinner'];

    let daysHtml = '';
    Array.from(mealsByDay.entries())
        .sort(([a], [b]) => a - b)
        .forEach(([dayIndex, meals]) => {
            let mealsHtml = '';
            meals
                .sort((a, b) => mealOrder.indexOf(a.mealType) - mealOrder.indexOf(b.mealType))
                .forEach((meal) => {
                    // Group food items by optionGroup
                    const optionGroups = new Map<number, typeof meal.foodItems>();
                    meal.foodItems.forEach((item) => {
                        const group = (item as any).optionGroup ?? 0;
                        if (!optionGroups.has(group)) optionGroups.set(group, []);
                        optionGroups.get(group)!.push(item);
                    });

                    const sortedGroups = Array.from(optionGroups.entries()).sort(([a], [b]) => a - b);
                    const hasAlts = sortedGroups.length > 1;

                    let foodItemsHtml = '';
                    sortedGroups.forEach(([groupNum, items], groupIdx) => {
                        if (hasAlts) {
                            const label = (items[0] as any).optionLabel || `Option ${String.fromCharCode(65 + groupNum)}`;
                            foodItemsHtml += `<div class="option-label">${escapeHtml(label)}</div>`;
                        }
                        const listItems = items
                            .map((item) => {
                                const foodName = item.foodItem?.name || 'Unknown';
                                const qty = item.quantityG ? `${item.quantityG}g` : '';
                                return `<li>${escapeHtml(foodName)} ${qty}</li>`;
                            })
                            .join('');
                        foodItemsHtml += `<ul class="food-items">${listItems}</ul>`;

                        if (hasAlts && groupIdx < sortedGroups.length - 1) {
                            foodItemsHtml += `<div class="or-divider">— OR —</div>`;
                        }
                    });

                    mealsHtml += `
                    <div class="meal">
                        <div class="meal-type">${MEAL_TYPE_LABELS[meal.mealType] || escapeHtml(meal.mealType)}</div>
                        <div class="meal-name">${escapeHtml(meal.name)}</div>
                        ${meal.description ? `<p class="description">${escapeHtml(meal.description)}</p>` : ''}
                        ${foodItemsHtml}
                        ${meal.instructions ? `<p class="instructions">${escapeHtml(meal.instructions)}</p>` : ''}
                    </div>
                `;
                });

            daysHtml += `
            <div class="day">
                <h2>${dayNames[dayIndex] || `Day ${dayIndex + 1}`}</h2>
                ${mealsHtml}
            </div>
        `;
        });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diet Plan - ${escapeHtml(plan.name)}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; line-height: 1.5; padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 28px; text-align: center; margin-bottom: 8px; }
        .subtitle { text-align: center; color: #6b7280; margin-bottom: 32px; }
        .targets { background: #f3f4f6; padding: 16px 24px; border-radius: 12px; display: flex; gap: 24px; justify-content: center; margin-bottom: 32px; flex-wrap: wrap; }
        .target { text-align: center; }
        .target-value { font-size: 24px; font-weight: 700; color: #17cf54; }
        .target-label { font-size: 12px; color: #6b7280; }
        .day { margin-bottom: 32px; page-break-inside: avoid; }
        .day h2 { font-size: 20px; border-bottom: 2px solid #17cf54; padding-bottom: 8px; margin-bottom: 16px; }
        .meal { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
        .meal-type { font-size: 14px; color: #17cf54; font-weight: 600; }
        .meal-name { font-size: 16px; font-weight: 600; margin: 4px 0; }
        .description { font-size: 14px; color: #6b7280; margin: 8px 0; }
        .food-items { margin: 12px 0; padding-left: 20px; }
        .food-items li { font-size: 14px; margin: 4px 0; }
        .instructions { font-size: 13px; color: #6b7280; font-style: italic; }
        .option-label { font-size: 13px; font-weight: 600; color: #17cf54; margin: 8px 0 4px 0; }
        .or-divider { text-align: center; color: #9ca3af; font-size: 12px; margin: 8px 0; font-weight: 500; }
        .notes { background: #f9fafb; padding: 20px; border-radius: 12px; margin-top: 32px; }
        .notes h3 { font-size: 16px; margin-bottom: 12px; }
        .notes p { font-size: 14px; color: #374151; }
        @media print { body { padding: 20px; } .day { page-break-inside: avoid; } }
    </style>
</head>
<body>
    <h1>${escapeHtml(plan.name)}</h1>
    ${plan.client?.fullName ? `<p class="subtitle">Prepared for: ${escapeHtml(plan.client.fullName)}</p>` : ''}
    
    ${plan.targetCalories ? `
    <div class="targets">
        <div class="target"><div class="target-value">${plan.targetCalories}</div><div class="target-label">Calories</div></div>
        ${plan.targetProteinG ? `<div class="target"><div class="target-value">${plan.targetProteinG}g</div><div class="target-label">Protein</div></div>` : ''}
        ${plan.targetCarbsG ? `<div class="target"><div class="target-value">${plan.targetCarbsG}g</div><div class="target-label">Carbs</div></div>` : ''}
        ${plan.targetFatsG ? `<div class="target"><div class="target-value">${plan.targetFatsG}g</div><div class="target-label">Fats</div></div>` : ''}
    </div>
    ` : ''}
    
    ${daysHtml}
    
    ${plan.notesForClient ? `<div class="notes"><h3>Notes & Guidelines</h3><p>${escapeHtml(plan.notesForClient)}</p></div>` : ''}
</body>
</html>`;
}
