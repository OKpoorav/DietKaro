import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authStore } from '../store/authStore';
import { clientAuthApi, deviceApi, setForceLogoutHandler } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { registerForPushNotifications, setupNotificationResponseListener } from '../services/notifications';
import { Client } from '../types';

interface AuthContextValue {
    isAuthenticated: boolean;
    isLoading: boolean;
    client: Client | null;
    login: (clerkToken: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshClient: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function registerPushToken() {
    try {
        const token = await registerForPushNotifications();
        if (token) {
            await deviceApi.registerToken(token);
        }
    } catch (error) {
        console.error('Failed to register push token:', error);
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [client, setClient] = useState<Client | null>(null);
    const notificationListenerRef = useRef<{ remove: () => void } | null>(null);

    useEffect(() => {
        checkAuth();
        setForceLogoutHandler(() => {
            disconnectSocket();
            setClient(null);
            setIsAuthenticated(false);
        });

        notificationListenerRef.current = setupNotificationResponseListener();
        return () => {
            notificationListenerRef.current?.remove();
        };
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
                connectSocket();
                registerPushToken();
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

    // Exchanges a Clerk session token for our backend JWT
    const login = useCallback(async (clerkToken: string) => {
        const response = await clientAuthApi.clerkLogin(clerkToken);
        const { token, refreshToken, client: clientData } = response.data.data;

        await authStore.setToken(token);
        if (refreshToken) await authStore.setRefreshToken(refreshToken);
        await authStore.setClientData(clientData);

        setClient(clientData);
        setIsAuthenticated(true);
        connectSocket();
        registerPushToken();
    }, []);

    const logout = useCallback(async () => {
        disconnectSocket();
        await authStore.removeToken();
        setClient(null);
        setIsAuthenticated(false);
    }, []);

    const refreshClient = useCallback(async () => {
        try {
            const response = await clientAuthApi.getProfile();
            const clientData = response.data.data;
            await authStore.setClientData(clientData);
            setClient(clientData);
        } catch (error) {
            console.error('Failed to refresh client data:', error);
        }
    }, []);

    const value = useMemo(() => ({
        isAuthenticated,
        isLoading,
        client,
        login,
        logout,
        refreshClient,
    }), [isAuthenticated, isLoading, client, login, logout, refreshClient]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export { AuthContext };
