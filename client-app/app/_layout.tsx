import { Slot } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30 * 1000,
            retry: 2,
        },
    },
});

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <Slot />
        </QueryClientProvider>
    );
}
