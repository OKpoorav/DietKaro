// API Types for Client App

/** Standard API response envelope */
export interface ApiResponse<T> {
    success: boolean;
    data: T;
}

/** Error shape returned by the backend on failure */
export interface ApiErrorResponse {
    success: false;
    message: string;
    errors?: Record<string, string[]>;
}

export interface Client {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    profilePhotoUrl?: string;
    heightCm?: number;
    currentWeightKg?: number;
    targetWeightKg?: number;
    dietaryPreferences: string[];
    allergies: string[];
}

export interface Meal {
    id: string;
    planId: string;
    mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
    name: string;
    description?: string;
    timeOfDay?: string;
    instructions?: string;
    totalCalories?: number;
    totalProteinG?: number;
    totalCarbsG?: number;
    totalFatsG?: number;
    foodItems: MealFoodItem[];
}

export interface MealFoodItem {
    id: string;
    foodId: string;
    foodName: string;
    quantityG: number;
    calories?: number;
}

export interface MealLog {
    id: string;
    mealId: string;
    scheduledDate: string;
    scheduledTime?: string;
    status: 'pending' | 'eaten' | 'skipped' | 'substituted';
    mealPhotoUrl?: string;
    clientNotes?: string;
    dietitianFeedback?: string;
    dietitianFeedbackAt?: string;
    loggedAt?: string;
    meal: Meal;
}

export interface WeightLog {
    id: string;
    weightKg: number;
    logDate: string;
    notes?: string;
    weightChangeFromPrevious?: number;
}

export interface ClientStats {
    weeklyAdherence: number;
    mealCompletionRate: number;
    weightTrend: 'up' | 'down' | 'stable';
    latestWeight?: number;
    targetWeight?: number;
    currentStreak: number;
}

export interface AuthResponse {
    success: boolean;
    data: {
        token: string;
        client: Client;
    };
}

export interface OTPRequestResponse {
    success: boolean;
    message: string;
}

export interface Notification {
    id: string;
    type: 'feedback' | 'reminder' | 'weight' | 'system';
    title: string;
    message?: string;
    timestamp: string;
    read: boolean;
    avatar?: string;
}

export interface Report {
    id: string;
    fileName: string;
    fileType: string;
    reportType: string;
    uploadedAt: string;
}

export interface UploadUrlResponse {
    uploadUrl: string;
    key: string;
}

export interface ReferralData {
    referralCode: string;
    shareMessage: string;
    whatsappLink: string;
}

export interface ReferralStats {
    referralCount: number;
    freeMonthsEarned: number;
    freeMonthsUsed: number;
    freeMonthsRemaining: number;
    referralsUntilNextReward: number;
    referredClients: { name: string; joinedAt: string }[];
}
