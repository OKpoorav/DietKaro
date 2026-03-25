import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail } from 'lucide-react-native';
import { useSignIn, useSignUp } from '@clerk/clerk-expo';
import { clientAuthApi } from '../../services/api';
import { useToast } from '../../components/Toast';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, CommonStyles } from '../../constants/theme';

export default function LoginScreen() {
    const router = useRouter();
    const { signIn, isLoaded: signInLoaded } = useSignIn();
    const { signUp, isLoaded: signUpLoaded } = useSignUp();
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const isLoaded = signInLoaded && signUpLoaded;

    const handleSendOTP = async () => {
        if (!isValidEmail || !isLoaded) return;

        setIsLoading(true);
        try {
            // First check if email exists as a client in our DB
            await clientAuthApi.checkEmail(email.trim());

            // Try sign in first (returning user)
            await signIn!.create({
                identifier: email.trim(),
                strategy: 'email_code',
            });
            router.push({ pathname: '/(auth)/verify', params: { email: email.trim(), flow: 'signIn' } });
        } catch (signInError: unknown) {
            // If account not found in Clerk, create one and send OTP via sign up
            const clerkError = signInError as { errors?: { code: string; message: string }[]; code?: string; message?: string };
            const errCode = clerkError?.errors?.[0]?.code ?? clerkError?.code ?? '';
            const errMsg = clerkError?.errors?.[0]?.message ?? clerkError?.message ?? '';
            const isNotFound = errCode === 'form_identifier_not_found' || errMsg.toLowerCase().includes('find') || errMsg.toLowerCase().includes('account');
            if (isNotFound) {
                try {
                    await signUp!.create({ emailAddress: email.trim() });
                    await signUp!.prepareEmailAddressVerification({ strategy: 'email_code' });
                    router.push({ pathname: '/(auth)/verify', params: { email: email.trim(), flow: 'signUp' } });
                } catch (signUpError: unknown) {
                    const message = signUpError instanceof Error ? signUpError.message : 'Failed to send OTP';
                    showToast({ title: 'Error', message, variant: 'error' });
                }
            } else {
                const message = signInError instanceof Error ? signInError.message : 'Failed to send OTP. Please try again.';
                showToast({ title: 'Error', message, variant: 'error' });
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <Mail size={32} color={Colors.primary} />
                    </View>
                    <Text style={styles.title}>Welcome to HealthPractix</Text>
                    <Text style={styles.subtitle}>
                        Enter your email address to get started with your personalized diet plan
                    </Text>
                </View>

                <View style={styles.form}>
                    <Text style={styles.label}>Email Address</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="you@example.com"
                            placeholderTextColor={Colors.textSecondary}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                            autoFocus
                        />
                    </View>

                    <TouchableOpacity
                        style={[CommonStyles.primaryButton, !isValidEmail && CommonStyles.primaryButtonDisabled]}
                        onPress={handleSendOTP}
                        disabled={isLoading || !isValidEmail}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={Colors.text} />
                        ) : (
                            <Text style={CommonStyles.primaryButtonText}>Send OTP</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <Text style={styles.footer}>
                    By continuing, you agree to our Terms of Service and Privacy Policy
                </Text>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        flex: 1,
        padding: Spacing.xxl,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: Colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xxl,
    },
    title: {
        fontSize: FontSizes.xxxl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        marginBottom: Spacing.md,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: FontSizes.lg,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: Spacing.lg,
    },
    form: {
        marginBottom: Spacing.xxxl,
    },
    label: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surface,
        marginBottom: Spacing.xxl,
        paddingHorizontal: Spacing.lg,
    },
    input: {
        flex: 1,
        height: 56,
        fontSize: FontSizes.lg,
        color: Colors.text,
    },
    footer: {
        fontSize: FontSizes.xs,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
    },
});
