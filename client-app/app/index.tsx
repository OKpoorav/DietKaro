import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { LoadingScreen } from '../components/LoadingScreen';

export default function Index() {
    const { isAuthenticated, isLoading, client } = useAuth();

    if (isLoading) {
        return <LoadingScreen />;
    }

    if (isAuthenticated) {
        if (!client?.onboardingCompleted) {
            return <Redirect href="/(onboarding)/step1" />;
        }
        return <Redirect href="/(tabs)/home" />;
    }

    return <Redirect href="/(auth)/login" />;
}
