import { Slot } from 'expo-router';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { ToastProvider } from '../components/Toast';
import { AuthProvider } from '../contexts/AuthContext';
import { normalizeError } from '../utils/errorHandler';

// Tell react-query about actual network state so it pauses
// mutations when offline and replays them on reconnect.
onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
        setOnline(!!state.isConnected);
    });
});

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Keep data in cache for 5 minutes so screens don't go blank offline
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: (failureCount, error) => {
                const normalized = normalizeError(error);
                if (!normalized.isRetryable) return false;
                return failureCount < 3;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            refetchOnReconnect: 'always',
        },
        mutations: {
            retry: 1,
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
