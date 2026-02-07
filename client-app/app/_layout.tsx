import { Slot } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../components/Toast';
import { AuthProvider } from '../contexts/AuthContext';
import { normalizeError } from '../utils/errorHandler';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30 * 1000,
            retry: (failureCount, error) => {
                const normalized = normalizeError(error);
                if (!normalized.isRetryable) return false;
                return failureCount < 3;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        },
        mutations: {
            retry: 0,
        },
    },
});

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <AuthProvider>
                    <Slot />
                </AuthProvider>
            </ToastProvider>
        </QueryClientProvider>
    );
}
