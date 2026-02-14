import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { authStore } from '../store/authStore';
import Constants from 'expo-constants';
import {
    ApiResponse,
    Client,
    ClientPreferences,
    MealLog,
    WeightLog,
    ClientStats,
    Report,
    UploadUrlResponse,
    ReferralData,
    ReferralStats,
    DailyAdherence,
    WeeklyAdherence,
    ComplianceHistory,
    OnboardingStatus,
    ProgressSummary,
} from '../types';

function getApiBaseUrl(): string {
    const configuredUrl = Constants.expoConfig?.extra?.apiUrl;

    if (configuredUrl) {
        return configuredUrl;
    }

    // In development, allow fallback to localhost for simulator convenience
    if (__DEV__) {
        console.warn(
            '[API] No apiUrl configured in app.json extra field. ' +
            'Falling back to http://localhost:3000/api/v1. ' +
            'This will NOT work on physical devices. ' +
            'Set expo.extra.apiUrl in app.json or app.config.ts.'
        );
        return 'http://localhost:3000/api/v1';
    }

    // In production, refuse to start with a broken URL
    throw new Error(
        'FATAL: API URL is not configured. ' +
        'Set expo.extra.apiUrl in app.json or use an app.config.ts with EAS environment variables. ' +
        'The app cannot function without a valid API endpoint.'
    );
}

const API_BASE_URL = getApiBaseUrl();

const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
        const token = await authStore.getToken();
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            await authStore.removeToken();
            // Navigation to login will be handled by useAuth hook
        }
        return Promise.reject(error);
    }
);

// Client Auth API - uses /client-auth endpoints
export const clientAuthApi = {
    requestOTP: (phone: string) =>
        api.post<ApiResponse<{ message: string }>>('/client-auth/request-otp', { phone }),

    verifyOTP: (phone: string, otp: string) =>
        api.post<ApiResponse<{ token: string; client: Client }>>('/client-auth/verify-otp', { phone, otp }),

    getProfile: () =>
        api.get<ApiResponse<Client>>('/client-auth/me'),

    updateProfile: (data: { fullName?: string; email?: string }) =>
        api.patch<ApiResponse<Client>>('/client-auth/me', data),
};

// Meal Logs API - client's own meals
export const mealLogsApi = {
    getTodayMeals: () =>
        api.get<ApiResponse<MealLog[]>>('/client/meals/today'),

    getMealLog: (mealLogId: string) =>
        api.get<ApiResponse<MealLog>>(`/client/meals/${mealLogId}`),

    logMeal: (mealId: string, data: { status: string; photoUrl?: string; notes?: string; chosenOptionGroup?: number }) =>
        api.patch<ApiResponse<MealLog>>(`/client/meals/${mealId}/log`, data),

    uploadPhoto: (mealId: string, formData: FormData) =>
        api.post<ApiResponse<{ url: string }>>(`/client/meals/${mealId}/photo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 60000,
        }),
};

// Weight Logs API - uses the client endpoint with clientId from token
export const weightLogsApi = {
    getWeightLogs: (params?: { limit?: number }) =>
        api.get<ApiResponse<WeightLog[]>>('/client/weight-logs', { params }),

    createWeightLog: (data: { weightKg: number; logDate: string; notes?: string }) =>
        api.post<ApiResponse<WeightLog>>('/client/weight-logs', data),
};

// Client Stats API
export const clientStatsApi = {
    getStats: () =>
        api.get<ApiResponse<ClientStats>>('/client/stats'),
    getProgressSummary: () =>
        api.get<ApiResponse<ProgressSummary>>('/client/progress-summary'),
};

// Reports API
export const reportsApi = {
    getReports: () =>
        api.get<ApiResponse<Report[]>>('/client/reports'),

    getUploadUrl: (data: { fileName: string; fileType: string; reportType: string }) =>
        api.post<ApiResponse<UploadUrlResponse>>('/client/reports/upload-url', data),

    createReport: (data: { key: string; fileName: string; fileType: string; reportType: string }) =>
        api.post<ApiResponse<Report>>('/client/reports', data),

    deleteReport: (id: string) =>
        api.delete<ApiResponse<void>>(`/client/reports/${id}`),
};

// Referral API
export const referralApi = {
    getCode: () =>
        api.get<ApiResponse<ReferralData>>('/client/referral/code'),

    getStats: () =>
        api.get<ApiResponse<ReferralStats>>('/client/referral/stats'),
};

// Onboarding API
export const onboardingApi = {
    getStatus: () =>
        api.get<ApiResponse<OnboardingStatus>>('/client/onboarding/status'),

    saveStep: (step: number, data: any) =>
        api.post<ApiResponse<{ message: string }>>(`/client/onboarding/step/${step}`, data),

    complete: () =>
        api.post<ApiResponse<{ message: string }>>('/client/onboarding/complete'),

    getPresets: () =>
        api.get<ApiResponse<any[]>>('/client/onboarding/presets'),
};

// Preferences API
export const preferencesApi = {
    get: () =>
        api.get<ApiResponse<ClientPreferences | null>>('/client/preferences'),

    update: (data: Partial<Omit<ClientPreferences, 'id'>>) =>
        api.put<ApiResponse<ClientPreferences>>('/client/preferences', data),
};

// Adherence / Compliance API
export const adherenceApi = {
    getDaily: (date?: string) =>
        api.get<ApiResponse<DailyAdherence>>('/client/adherence/daily', { params: date ? { date } : {} }),

    getWeekly: (weekStart?: string) =>
        api.get<ApiResponse<WeeklyAdherence>>('/client/adherence/weekly', { params: weekStart ? { weekStart } : {} }),

    getHistory: (days: number = 30) =>
        api.get<ApiResponse<ComplianceHistory>>('/client/adherence/history', { params: { days } }),
};

export default api;
