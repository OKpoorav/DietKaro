import { Stack } from 'expo-router';

export default function OnboardingLayout() {
    return (
        <Stack>
            <Stack.Screen
                name="step1"
                options={{
                    title: 'Basic Info',
                    headerBackVisible: false
                }}
            />
            <Stack.Screen
                name="step2"
                options={{ title: 'Diet Pattern' }}
            />
            <Stack.Screen
                name="step3"
                options={{ title: 'Allergies' }}
            />
            <Stack.Screen
                name="step4"
                options={{ title: 'Restrictions' }}
            />
            <Stack.Screen
                name="step5"
                options={{ title: 'Preferences' }}
            />
        </Stack>
    );
}
