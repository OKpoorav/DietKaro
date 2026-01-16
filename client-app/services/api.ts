import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { authStore } from '../store/authStore';
import Constants from 'expo-constants';

// Use the local IP for development - change this for production
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000/api/v1';

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
        api.post<{ success: boolean; message: string }>('/client-auth/request-otp', { phone }),

    verifyOTP: (phone: string, otp: string) =>
        api.post<{ success: boolean; data: { token: string; client: unknown } }>('/client-auth/verify-otp', { phone, otp }),

    getProfile: () =>
        api.get<{ success: boolean; data: unknown }>('/client-auth/me'),

    updateProfile: (data: { fullName?: string; email?: string }) =>
        api.patch<{ success: boolean; data: unknown }>('/client-auth/me', data),
};

// Meal Logs API - client's own meals
export const mealLogsApi = {
    getTodayMeals: () =>
        api.get<{ success: boolean; data: unknown[] }>('/client/meals/today'),

    getMealLog: (mealLogId: string) =>
        api.get<{ success: boolean; data: unknown }>(`/client/meals/${mealLogId}`),

    logMeal: (mealId: string, data: { status: string; photoUrl?: string; notes?: string }) =>
        api.patch<{ success: boolean; data: unknown }>(`/client/meals/${mealId}/log`, data),

    uploadPhoto: (mealId: string, formData: FormData) =>
        api.post<{ success: boolean; data: { url: string } }>(`/client/meals/${mealId}/photo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),
};

// Weight Logs API - uses the client endpoint with clientId from token
export const weightLogsApi = {
    getWeightLogs: (params?: { limit?: number }) =>
        api.get<{ success: boolean; data: unknown[] }>('/client/weight-logs', { params }),

    createWeightLog: (data: { weightKg: number; logDate: string; notes?: string }) =>
        api.post<{ success: boolean; data: unknown }>('/client/weight-logs', data),
};

// Client Stats API
export const clientStatsApi = {
    getStats: () =>
        api.get<{ success: boolean; data: unknown }>('/client/stats'),
};

export default api;
