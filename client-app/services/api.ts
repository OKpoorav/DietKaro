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

let onForceLogout: (() => void) | null = null;
export function setForceLogoutHandler(handler: () => void) {
    onForceLogout = handler;
}

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
        // Prevent stale 304 responses on React Native
        if (config.headers) {
            config.headers['Cache-Control'] = 'no-cache';
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for error handling
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            if (isRefreshing) {
                // Queue request until refresh completes
                return new Promise((resolve) => {
                    pendingRequests.push((token) => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        resolve(api(originalRequest));
                    });
                });
            }

            isRefreshing = true;

            try {
                const refreshToken = await authStore.getRefreshToken();
                if (!refreshToken) throw new Error('No refresh token');

                const res = await axios.post(`${API_BASE_URL}/client-auth/refresh`, { refreshToken });
                const { accessToken, refreshToken: newRefreshToken } = res.data.data;

                await authStore.setToken(accessToken);
                await authStore.setRefreshToken(newRefreshToken);

                // Flush queued requests
                pendingRequests.forEach((cb) => cb(accessToken));
                pendingRequests = [];

                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return api(originalRequest);
            } catch {
                pendingRequests = [];
                await authStore.removeToken();
                onForceLogout?.();
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

// Client Auth API - uses /client-auth endpoints
export const clientAuthApi = {
    // TODO: Re-enable phone OTP when SMS delivery is set up
    // requestOTP: (phone: string) =>
    //     api.post<ApiResponse<{ message: string }>>('/client-auth/request-otp', { phone }),
    // verifyOTP: (phone: string, otp: string) =>
    //     api.post<ApiResponse<{ token: string; client: Client }>>('/client-auth/verify-otp', { phone, otp }),

    // Pre-check: verify email exists as a client before sending Clerk OTP
    checkEmail: (email: string) =>
        api.post<ApiResponse<null>>('/client-auth/check-email', { email }),

    // Exchanges a Clerk session token for a backend JWT
    clerkLogin: (clerkToken: string) =>
        api.post<ApiResponse<{ token: string; accessToken: string; refreshToken: string; expiresIn: number; client: Client }>>('/client-auth/clerk-login', { clerkToken }),

    getProfile: () =>
        api.get<ApiResponse<Client>>('/client-auth/me'),

    updateProfile: (data: { fullName?: string; email?: string }) =>
        api.patch<ApiResponse<Client>>('/client-auth/me', data),
};

// Meal Logs API - client's own meals
export const mealLogsApi = {
    getTodayMeals: () =>
        api.get<ApiResponse<MealLog[]>>('/client/meals/today'),

    getMealsByDateRange: (startDate: string, endDate: string) =>
        api.get<ApiResponse<MealLog[]>>('/client/meals/range', {
            params: { startDate, endDate },
        }),

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

// Notifications API
export const notificationsApi = {
    list: () =>
        api.get<ApiResponse<any[]>>('/client/notifications'),

    markRead: (id: string) =>
        api.patch<ApiResponse<void>>(`/client/notifications/${id}/read`),
};

// Device Token API
export const deviceApi = {
    registerToken: (token: string) =>
        api.post<ApiResponse<void>>('/client/device-token', { token }),
};

// Chat API
export const chatApi = {
    getConversations: () =>
        api.get<ApiResponse<any[]>>('/client/chat/conversations'),

    initiateConversation: () =>
        api.post<ApiResponse<any>>('/client/chat/conversations/initiate'),

    getMessages: (conversationId: string, cursor?: string) =>
        api.get<any>(`/client/chat/conversations/${conversationId}/messages`, {
            params: { limit: 50, ...(cursor ? { cursor } : {}) },
        }),

    getUnreadCounts: () =>
        api.get<ApiResponse<{ conversations: any[]; total: number }>>('/client/chat/unread'),
};

export default api;
