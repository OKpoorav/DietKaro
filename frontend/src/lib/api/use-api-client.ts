'use client';

import { useAuth } from '@clerk/nextjs';
import { useMemo, useRef } from 'react';
import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function useApiClient(): AxiosInstance {
    const { getToken } = useAuth();
    const getTokenRef = useRef(getToken);
    getTokenRef.current = getToken;

    const client = useMemo(() => {
        const instance = axios.create({
            baseURL: `${API_URL}/api/v1`,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Add auth token to every request
        instance.interceptors.request.use(async (config) => {
            try {
                const token = await getTokenRef.current();
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
            } catch (error) {
                console.error('Error getting auth token:', error);
            }
            return config;
        });

        // Handle response errors
        instance.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    window.location.href = '/sign-in';
                }
                const message =
                    error.response?.data?.error?.message ||
                    error.message ||
                    'An unexpected error occurred';
                console.error('API Error:', message);
                return Promise.reject(error);
            }
        );

        return instance;
    }, []);

    return client;
}
