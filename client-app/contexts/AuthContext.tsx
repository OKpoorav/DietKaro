import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authStore } from '../store/authStore';
import { clientAuthApi } from '../services/api';
import { Client } from '../types';

interface AuthContextValue {
    isAuthenticated: boolean;
    isLoading: boolean;
    client: Client | null;
    login: (phone: string, otp: string) => Promise<void>;
    logout: () => Promise<void>;
    requestOTP: (phone: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [client, setClient] = useState<Client | null>(null);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const token = await authStore.getToken();
            const isExpired = await authStore.checkSessionExpiry();

            if (token && !isExpired) {
                const clientData = await authStore.getClientData();
                setClient(clientData);
                setIsAuthenticated(true);
                await authStore.updateLastActivity();
            } else if (token && isExpired) {
                await authStore.removeToken();
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const requestOTP = useCallback(async (phone: string) => {
        await clientAuthApi.requestOTP(phone);
    }, []);

    const login = useCallback(async (phone: string, otp: string) => {
        const response = await clientAuthApi.verifyOTP(phone, otp);
        const { token, client: clientData } = response.data.data;

        await authStore.setToken(token);
        await authStore.setClientData(clientData);

        setClient(clientData);
        setIsAuthenticated(true);
    }, []);

    const logout = useCallback(async () => {
        await authStore.removeToken();
        setClient(null);
        setIsAuthenticated(false);
    }, []);

    const value = useMemo(() => ({
        isAuthenticated,
        isLoading,
        client,
        login,
        logout,
        requestOTP,
    }), [isAuthenticated, isLoading, client, login, logout, requestOTP]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export { AuthContext };
