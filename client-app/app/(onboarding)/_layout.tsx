import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Colors, Spacing, FontSizes, FontWeights } from '../../constants/theme';

const TOTAL_STEPS = 6;

function ProgressHeader({ step }: { step: number }) {
    return (
        <View style={styles.progressContainer}>
            <Text style={styles.stepLabel}>Step {step} of {TOTAL_STEPS}</Text>
            <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
            </View>
        </View>
    );
}

export default function OnboardingLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: Colors.surface },
                headerTintColor: Colors.text,
                headerShadowVisible: false,
            }}
        >
            <Stack.Screen
                name="step1"
                options={{
                    title: 'Basic Info',
                    headerBackVisible: false,
                    headerTitle: () => <ProgressHeader step={1} />,
                }}
            />
            <Stack.Screen
                name="step2"
                options={{
                    title: 'Diet Pattern',
                    headerTitle: () => <ProgressHeader step={2} />,
                }}
            />
            <Stack.Screen
                name="step3"
                options={{
                    title: 'Allergies',
                    headerTitle: () => <ProgressHeader step={3} />,
                }}
            />
            <Stack.Screen
                name="step4"
                options={{
                    title: 'Restrictions',
                    headerTitle: () => <ProgressHeader step={4} />,
                }}
            />
            <Stack.Screen
                name="step5"
                options={{
                    title: 'Preferences',
                    headerTitle: () => <ProgressHeader step={5} />,
                }}
            />
            <Stack.Screen
                name="step6"
                options={{
                    title: 'Measurements',
                    headerTitle: () => <ProgressHeader step={6} />,
                }}
            />
            <Stack.Screen
                name="complete"
                options={{
                    title: 'Complete',
                    headerShown: false,
                }}
            />
        </Stack>
    );
}

const styles = StyleSheet.create({
    progressContainer: {
        alignItems: 'center',
        flex: 1,
    },
    stepLabel: {
        fontSize: FontSizes.xs,
        color: Colors.textMuted,
        fontWeight: FontWeights.medium,
        marginBottom: Spacing.xs,
    },
    progressBar: {
        width: '100%',
        height: 4,
        backgroundColor: Colors.borderLight,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: Colors.primaryDark,
        borderRadius: 2,
    },
});
