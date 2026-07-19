export interface Store {
  id: string;
  name: string;
  displayOrder: number;
}

export interface Ingredient {
  id: string;
  key: string;
  name: string;
  packLabel: string;
  category: string | null;
}

export interface IngredientPrice {
  ingredientId: string;
  storeId: string;
  price: number;
  updatedAt: string;
}

export interface MealIngredient {
  ingredientId: string;
  packFraction: number;
  humanQuantity: string;
  sortOrder: number;
}

export type MealSource = "builtin" | "custom" | "ai";

export type MealCategory = "breakfast" | "lunch" | "dinner" | "snack" | "dessert";

export const MEAL_CATEGORY_LABELS: Record<MealCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  dessert: "Dessert",
};

export const MEAL_CATEGORIES: MealCategory[] = ["breakfast", "lunch", "dinner", "snack", "dessert"];

export interface Meal {
  id: string;
  slug: string;
  name: string;
  servings: number;
  proteinG: number;
  kcal: number;
  isVeggie: boolean;
  timeLabel: string | null;
  description: string;
  method: string[];
  source: MealSource;
  ownerId: string | null;
  category: MealCategory;
  ingredients: MealIngredient[];
}

export interface SnackPreset {
  id: string;
  name: string;
  kcal: number;
  proteinG: number;
  cost: number;
}

/** 0 = Monday ... 6 = Sunday, matching ISO weekday order used throughout the planner. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: "Mon",
  1: "Tue",
  2: "Wed",
  3: "Thu",
  4: "Fri",
  5: "Sat",
  6: "Sun",
};

export interface PlanEntry {
  id: string;
  dayOfWeek: DayOfWeek;
  mealId: string;
  servings: number;
}

export interface LogEntry {
  id: string;
  dayOfWeek: DayOfWeek;
  name: string;
  kcal: number;
  proteinG: number;
  cost: number;
  quantity: number;
  snackPresetId: string | null;
}

export interface UserTargets {
  dailyKcalTarget: number;
  dailyProteinTarget: number;
  weeklyBudget: number;
}
