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
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    snack: 'Snack',
    dinner: 'Dinner',
    pre_workout: 'Pre-Workout',
    post_workout: 'Post-Workout',
    other: 'Other',
};

const MEAL_TYPE_ORDER = ['breakfast', 'lunch', 'snack', 'dinner', 'pre_workout', 'post_workout', 'other'];

/** Resolve the calendar date for a meal — prefers mealDate, falls back to dayOfWeek offset from startDate */
function resolveMealDate(meal: MealWithFoodItems, planStartDate: Date): Date {
    if (meal.mealDate) return new Date(meal.mealDate);
    const d = new Date(planStartDate);
    d.setUTCDate(d.getUTCDate() + (meal.dayOfWeek ?? 0));
    return d;
}

/** Group meals into an ordered map of dateKey → (mealType → meals[]) */
function groupMealsByDate(meals: MealWithFoodItems[], startDate: Date): {
    sortedDateKeys: string[];
    byDate: Map<string, Map<string, MealWithFoodItems[]>>;
    mealTypes: string[];
} {
    const byDate = new Map<string, Map<string, MealWithFoodItems[]>>();
    const mealTypesFound = new Set<string>();

    for (const meal of meals) {
        const d = resolveMealDate(meal, startDate);
        const key = d.toISOString().slice(0, 10);
        const type = meal.mealType.toLowerCase();
        mealTypesFound.add(type);
        if (!byDate.has(key)) byDate.set(key, new Map());
        const typeMap = byDate.get(key)!;
        if (!typeMap.has(type)) typeMap.set(type, []);
        typeMap.get(type)!.push(meal);
    }

    const sortedDateKeys = Array.from(byDate.keys()).sort();
    const mealTypes = MEAL_TYPE_ORDER.filter(t => mealTypesFound.has(t));
    return { sortedDateKeys, byDate, mealTypes };
}

export function generateDietPlanPDF(plan: DietPlanWithRelations): PDFKit.PDFDocument {
    const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        info: {
            Title: `Diet Plan - ${plan.name}`,
            Author: 'HealthPractix',
            Subject: 'Personalized Diet Plan',
        },
    });

    const PAGE_W = 841.89 - 80; // A4 landscape width minus margins
    const startDate = new Date(plan.startDate);

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fontSize(20).fillColor(COLORS.dark).text(plan.name, { align: 'center' });

    if (plan.client?.fullName) {
        doc.fontSize(12).fillColor(COLORS.gray)
            .text(`Prepared for: ${plan.client.fullName}`, { align: 'center' });
    }

    const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const endDateStr = plan.endDate ? fmtDate(new Date(plan.endDate)) : 'Ongoing';
    doc.fontSize(10).fillColor(COLORS.gray)
        .text(`${fmtDate(startDate)} – ${endDateStr}`, { align: 'center' });

    doc.moveDown();

    // ── Nutritional Targets ─────────────────────────────────────────────────
    if (plan.targetCalories) {
        const boxY = doc.y;
        doc.rect(40, boxY, PAGE_W, 50).fill('#f3f4f6');
        const colW = PAGE_W / 5;
        const targets = [
            `Calories: ${plan.targetCalories} kcal`,
            `Protein: ${plan.targetProteinG ?? '-'} g`,
            `Carbs: ${plan.targetCarbsG ?? '-'} g`,
            `Fats: ${plan.targetFatsG ?? '-'} g`,
            `Fiber: ${plan.targetFiberG ?? '-'} g`,
        ];
        targets.forEach((t, i) => {
            doc.fontSize(10).fillColor(COLORS.dark)
                .text(t, 40 + i * colW, boxY + 18, { width: colW, align: 'center' });
        });
        doc.y = boxY + 58;
    }

    doc.moveDown(0.5);

    // ── Spreadsheet Table ───────────────────────────────────────────────────
    const { sortedDateKeys, byDate, mealTypes } = groupMealsByDate(plan.meals, startDate);

    if (sortedDateKeys.length === 0) {
        doc.fontSize(11).fillColor(COLORS.gray).text('No meals in this plan.');
        doc.end();
        return doc;
    }

    const DATE_COL_W = 70;
    const mealColW = Math.max(100, (PAGE_W - DATE_COL_W) / mealTypes.length);
    const ROW_PAD = 8;
    const LINE_H = 12;

    // Header row
    let tableY = doc.y;
    doc.rect(40, tableY, PAGE_W, 22).fill('#1f2937');
    doc.fontSize(9).fillColor('#ffffff')
        .text('Date', 40 + 4, tableY + 6, { width: DATE_COL_W - 4 });
    mealTypes.forEach((type, i) => {
        doc.text(
            (MEAL_TYPE_LABELS[type] || type).toUpperCase(),
            40 + DATE_COL_W + i * mealColW + 4,
            tableY + 6,
            { width: mealColW - 4 }
        );
    });
    tableY += 22;

    // Data rows
    sortedDateKeys.forEach((dateKey, rowIdx) => {
        const typeMap = byDate.get(dateKey)!;
        const date = new Date(dateKey + 'T00:00:00Z');
        const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
        const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

        // Calculate row height needed
        let maxLines = 1;
        mealTypes.forEach(type => {
            const meals = typeMap.get(type) || [];
            let lines = 0;
            meals.forEach(m => {
                if (m.timeOfDay) lines += 1;
                lines += m.foodItems.length;
                lines += 0.5; // spacing
            });
            maxLines = Math.max(maxLines, lines);
        });
        const rowH = Math.max(40, maxLines * LINE_H + ROW_PAD * 2);

        // Page break
        if (tableY + rowH > 550) {
            doc.addPage({ size: 'A4', layout: 'landscape' });
            tableY = 40;
            // Repeat header
            doc.rect(40, tableY, PAGE_W, 22).fill('#1f2937');
            doc.fontSize(9).fillColor('#ffffff').text('Date', 40 + 4, tableY + 6, { width: DATE_COL_W - 4 });
            mealTypes.forEach((type, i) => {
                doc.text(
                    (MEAL_TYPE_LABELS[type] || type).toUpperCase(),
                    40 + DATE_COL_W + i * mealColW + 4,
                    tableY + 6,
                    { width: mealColW - 4 }
                );
            });
            tableY += 22;
        }

        // Row background
        doc.rect(40, tableY, PAGE_W, rowH).fill(rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb');

        // Date cell
        doc.fontSize(9).fillColor(COLORS.dark)
            .text(dayLabel, 40 + 4, tableY + ROW_PAD, { width: DATE_COL_W - 8 });
        doc.fontSize(8).fillColor(COLORS.gray)
            .text(dateLabel, 40 + 4, tableY + ROW_PAD + LINE_H, { width: DATE_COL_W - 8 });

        // Meal cells
        mealTypes.forEach((type, i) => {
            const meals = typeMap.get(type) || [];
            let cellY = tableY + ROW_PAD;
            const cellX = 40 + DATE_COL_W + i * mealColW + 4;
            const cellW = mealColW - 8;

            if (meals.length === 0) {
                doc.fontSize(9).fillColor('#d1d5db').text('—', cellX, cellY, { width: cellW });
                return;
            }

            meals.forEach(meal => {
                if (meal.timeOfDay) {
                    doc.fontSize(7).fillColor(COLORS.gray)
                        .text(meal.timeOfDay, cellX, cellY, { width: cellW });
                    cellY += LINE_H;
                }

                // Group food items by optionGroup
                const optionGroups = new Map<number, typeof meal.foodItems>();
                meal.foodItems.forEach(item => {
                    const g = (item as any).optionGroup ?? 0;
                    if (!optionGroups.has(g)) optionGroups.set(g, []);
                    optionGroups.get(g)!.push(item);
                });
                const sortedGroups = Array.from(optionGroups.entries()).sort(([a], [b]) => a - b);
                const hasAlts = sortedGroups.length > 1;

                sortedGroups.forEach(([, items], gIdx) => {
                    if (hasAlts) {
                        if (gIdx > 0) {
                            doc.fontSize(7).fillColor(COLORS.gray)
                                .text('— OR —', cellX, cellY, { width: cellW });
                            cellY += LINE_H;
                        }
                        const label = (items[0] as any).optionLabel || `Option ${String.fromCharCode(65 + gIdx)}`;
                        doc.fontSize(7).fillColor(COLORS.primary)
                            .text(label, cellX, cellY, { width: cellW });
                        cellY += LINE_H;
                    }
                    items.forEach(item => {
                        const name = item.foodItem?.name || 'Unknown';
                        const qty = item.quantityG ? ` ${item.quantityG}g` : '';
                        doc.fontSize(8).fillColor(COLORS.dark)
                            .text(`• ${name}${qty}`, cellX, cellY, { width: cellW });
                        cellY += LINE_H;
                    });
                });
                cellY += ROW_PAD / 2;
            });
        });

        // Row borders
        doc.rect(40, tableY, PAGE_W, rowH).strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();
        // Column borders
        doc.moveTo(40 + DATE_COL_W, tableY).lineTo(40 + DATE_COL_W, tableY + rowH)
            .strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();
        mealTypes.forEach((_, i) => {
            if (i < mealTypes.length - 1) {
                const x = 40 + DATE_COL_W + (i + 1) * mealColW;
                doc.moveTo(x, tableY).lineTo(x, tableY + rowH)
                    .strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();
            }
        });

        tableY += rowH;
    });

    // ── Notes ───────────────────────────────────────────────────────────────
    if (plan.notesForClient) {
        doc.addPage({ size: 'A4', layout: 'landscape' });
        doc.fontSize(14).fillColor(COLORS.dark).text('Notes & Guidelines', { underline: true });
        doc.moveDown(0.5)
            .fontSize(11).fillColor(COLORS.gray)
            .text(plan.notesForClient, { lineGap: 4 });
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.fontSize(7).fillColor(COLORS.lightGray)
        .text(`Generated by HealthPractix on ${new Date().toLocaleDateString('en-IN')}`, 40, 575, {
            align: 'center',
            width: PAGE_W,
        });

    return doc;
}

export function generateMealPlanPrintHtml(plan: DietPlanWithRelations): string {
    const startDate = new Date(plan.startDate);
    const { sortedDateKeys, byDate, mealTypes } = groupMealsByDate(plan.meals, startDate);

    const fmtDate = (d: Date) => d.toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
    });

    // Build table header
    const thCells = mealTypes.map(t =>
        `<th>${escapeHtml(MEAL_TYPE_LABELS[t] || t)}</th>`
    ).join('');

    // Build table rows
    const rows = sortedDateKeys.map(dateKey => {
        const typeMap = byDate.get(dateKey)!;
        const date = new Date(dateKey + 'T00:00:00Z');

        const tdCells = mealTypes.map(type => {
            const meals = typeMap.get(type) || [];
            if (meals.length === 0) return `<td class="empty">—</td>`;

            const inner = meals.map(meal => {
                const timeHtml = meal.timeOfDay ? `<div class="time">${escapeHtml(meal.timeOfDay)}</div>` : '';

                const optionGroups = new Map<number, typeof meal.foodItems>();
                meal.foodItems.forEach(item => {
                    const g = (item as any).optionGroup ?? 0;
                    if (!optionGroups.has(g)) optionGroups.set(g, []);
                    optionGroups.get(g)!.push(item);
                });
                const sortedGroups = Array.from(optionGroups.entries()).sort(([a], [b]) => a - b);
                const hasAlts = sortedGroups.length > 1;

                const foodsHtml = sortedGroups.map(([, items], gIdx) => {
                    const orDivider = hasAlts && gIdx > 0 ? `<div class="or-divider">— OR —</div>` : '';
                    const label = hasAlts
                        ? `<div class="option-label">${escapeHtml((items[0] as any).optionLabel || `Option ${String.fromCharCode(65 + gIdx)}`)}</div>`
                        : '';
                    const listItems = items.map(item => {
                        const name = item.foodItem?.name || 'Unknown';
                        const qty = item.quantityG ? ` ${item.quantityG}g` : '';
                        return `<li>${escapeHtml(name)}${escapeHtml(qty)}</li>`;
                    }).join('');
                    return `${orDivider}${label}<ul>${listItems}</ul>`;
                }).join('');

                return `<div class="meal-cell">${timeHtml}${foodsHtml}</div>`;
            }).join('');

            return `<td>${inner}</td>`;
        }).join('');

        return `<tr><td class="date-cell"><strong>${escapeHtml(fmtDate(date))}</strong></td>${tdCells}</tr>`;
    }).join('');

    const targetsHtml = plan.targetCalories ? `
    <div class="targets">
        <div class="target"><span class="val">${plan.targetCalories}</span><span class="lbl">kcal</span></div>
        ${plan.targetProteinG ? `<div class="target"><span class="val">${plan.targetProteinG}g</span><span class="lbl">Protein</span></div>` : ''}
        ${plan.targetCarbsG ? `<div class="target"><span class="val">${plan.targetCarbsG}g</span><span class="lbl">Carbs</span></div>` : ''}
        ${plan.targetFatsG ? `<div class="target"><span class="val">${plan.targetFatsG}g</span><span class="lbl">Fats</span></div>` : ''}
        ${plan.targetFiberG ? `<div class="target"><span class="val">${plan.targetFiberG}g</span><span class="lbl">Fiber</span></div>` : ''}
    </div>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Diet Plan - ${escapeHtml(plan.name)}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; padding: 32px; font-size: 13px; }
        h1 { font-size: 24px; text-align: center; margin-bottom: 4px; }
        .subtitle { text-align: center; color: #6b7280; margin-bottom: 8px; font-size: 14px; }
        .duration { text-align: center; color: #9ca3af; font-size: 12px; margin-bottom: 20px; }
        .targets { display: flex; gap: 20px; justify-content: center; background: #f3f4f6; border-radius: 10px; padding: 14px 24px; margin-bottom: 24px; flex-wrap: wrap; }
        .target { text-align: center; }
        .target .val { display: block; font-size: 20px; font-weight: 700; color: #17cf54; }
        .target .lbl { font-size: 11px; color: #6b7280; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        thead th { background: #1f2937; color: #fff; padding: 10px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
        tbody tr:nth-child(odd) { background: #fff; }
        tbody tr:nth-child(even) { background: #f9fafb; }
        td { padding: 8px 10px; vertical-align: top; border: 1px solid #e5e7eb; }
        .date-cell { white-space: nowrap; color: #374151; font-size: 12px; min-width: 110px; }
        .empty { color: #d1d5db; text-align: center; }
        .time { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
        ul { list-style: none; padding: 0; }
        li { font-size: 12px; color: #374151; padding: 1px 0; }
        li::before { content: "• "; color: #17cf54; }
        .option-label { font-size: 11px; font-weight: 600; color: #17cf54; margin: 4px 0 2px; }
        .or-divider { font-size: 10px; color: #9ca3af; text-align: center; margin: 4px 0; font-weight: 500; }
        .meal-cell + .meal-cell { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e5e7eb; }
        .notes { background: #f9fafb; padding: 16px 20px; border-radius: 10px; margin-top: 24px; }
        .notes h3 { font-size: 14px; margin-bottom: 8px; }
        .notes p { color: #374151; line-height: 1.6; }
        @media print {
            body { padding: 16px; }
            table { font-size: 11px; }
            thead th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            tbody tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <h1>${escapeHtml(plan.name)}</h1>
    ${plan.client?.fullName ? `<p class="subtitle">Prepared for: ${escapeHtml(plan.client.fullName)}</p>` : ''}
    <p class="duration">${new Date(plan.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}${plan.endDate ? ` – ${new Date(plan.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}` : ''}</p>
    ${targetsHtml}
    <table>
        <thead><tr><th>Date</th>${thCells}</tr></thead>
        <tbody>${rows}</tbody>
    </table>
    ${plan.notesForClient ? `<div class="notes"><h3>Notes & Guidelines</h3><p>${escapeHtml(plan.notesForClient)}</p></div>` : ''}
</body>
</html>`;
}
