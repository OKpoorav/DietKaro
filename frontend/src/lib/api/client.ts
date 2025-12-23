import axios, { AxiosError, AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Create axios instance
export const api: AxiosInstance = axios.create({
    baseURL: `${API_URL}/api/v1`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    async (config) => {
        // Token will be added by the useApiClient hook on the client side
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        const message =
            (error.response?.data as { error?: { message?: string } })?.error?.message ||
            error.message ||
            'An unexpected error occurred';

        console.error('API Error:', message);
        return Promise.reject(error);
    }
);

// API Types
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    meta?: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

export interface ApiError {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}

export default api;
