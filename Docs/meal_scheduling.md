# Meal Scheduling Logic

## Overview
Meals in DietKaro can be scheduled using two different approaches depending on the context.

## Fields
| Field | Type | Usage |
|-------|------|-------|
| `dayOfWeek` | Int (0-6) | Used for **recurring weekly plans** and templates. 0 = Sunday, 6 = Saturday. |
| `mealDate` | DateTime | Used for **specific date-based plans** with actual dates. |

## Rules

### 1. Templates
- Templates use `dayOfWeek` only
- `mealDate` should be `null`
- Represents a generic weekly plan

### 2. Active Client Plans
- Active plans should have `mealDate` set with actual dates
- `dayOfWeek` can be derived from `mealDate` if needed

### 3. Template Assignment
When assigning a template to a client with a `startDate`:
```
mealDate = startDate + (dayOfWeek + (7 - startDate.getDay())) % 7
```

## Validation Rules
1. **Templates**: Must have `dayOfWeek` set (0-6), `mealDate` should be null
2. **Active Plans**: Should have `mealDate` set within the diet plan's date range
3. **Date Range**: Meals should fall between `dietPlan.startDate` and `dietPlan.endDate`

## Example

### Template (Weekly Pattern)
```
Day 0 (Sunday): Breakfast - Oatmeal
Day 1 (Monday): Breakfast - Eggs & Toast
...
```

### Assigned Plan (Actual Dates)
```
2024-01-15: Breakfast - Oatmeal
2024-01-16: Breakfast - Eggs & Toast
...
```
