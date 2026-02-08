import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';
import { onboardingApi } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

export default function CompleteScreen() {
    const router = useRouter();
    const { refreshClient } = useAuth();
    const [completing, setCompleting] = useState(true);

    useEffect(() => {
        completeOnboarding();
    }, []);

    const completeOnboarding = async () => {
        try {
            await onboardingApi.complete();
            await refreshClient();
        } catch (error) {
            // Non-critical — user can still proceed
        } finally {
            setCompleting(false);
        }
    };

    const handleStart = () => {
        router.replace('/(tabs)/home');
    };

    if (completing) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={Colors.primaryDark} />
                <Text style={[styles.subtitle, { marginTop: Spacing.lg }]}>Setting up your profile...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <CheckCircle size={80} color={Colors.primaryDark} />
            </View>

            <Text style={styles.title}>All Set!</Text>
            <Text style={styles.subtitle}>
                Your profile has been set up. Your dietitian will now create a personalized plan for you based on these preferences.
            </Text>

            <TouchableOpacity
                style={styles.button}
                onPress={handleStart}
            >
                <Text style={styles.buttonText}>Go to Dashboard</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xxxl,
    },
    iconContainer: {
        marginBottom: Spacing.xxxl,
        shadowColor: Colors.primaryDark,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: FontSizes.display,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        marginBottom: Spacing.lg,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: FontSizes.lg,
        color: Colors.textMuted,
        marginBottom: 48,
        textAlign: 'center',
        lineHeight: 24,
    },
    button: {
        backgroundColor: Colors.primaryDark,
        paddingVertical: Spacing.xl,
        paddingHorizontal: Spacing.xxxl,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        width: '100%',
        shadowColor: Colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: Colors.surface,
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.semibold,
    }
});
