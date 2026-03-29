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
import { useSignIn, useSignUp, useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { clientAuthApi } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, CommonStyles } from '../../constants/theme';

export default function LoginScreen() {
    const router = useRouter();
    const { signIn, isLoaded: signInLoaded } = useSignIn();
    const { signUp, isLoaded: signUpLoaded } = useSignUp();
    const { isSignedIn, getToken, signOut } = useClerkAuth();
    const { login } = useAuth();
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
            let clientName = '';
            try {
                const checkResponse = await clientAuthApi.checkEmail(email.trim());
                clientName = checkResponse.data?.data?.fullName ?? '';
            } catch (checkError: unknown) {
                const status = (checkError as { response?: { status?: number } })?.response?.status;
                if (status === 404) {
                    showToast({
                        title: 'Account Not Found',
                        message: 'No account found with this email. Please contact your dietitian.',
                        variant: 'error',
                    });
                    return;
                }
                throw checkError;
            }

            // If already signed into Clerk, exchange existing session directly
            if (isSignedIn) {
                const clerkToken = await getToken();
                if (!clerkToken) {
                    await signOut();
                    throw new Error('Session expired. Please try again.');
                }
                await login(clerkToken);
                router.replace('/(tabs)/home');
                return;
            }

            // Try sign in first (returning user)
            try {
                await signIn!.create({
                    identifier: email.trim(),
                    strategy: 'email_code',
                });
                router.push({ pathname: '/(auth)/verify', params: { email: email.trim(), flow: 'signIn' } });
            } catch (signInError: unknown) {
                const clerkError = signInError as { errors?: { code: string; message: string }[] };
                const errCode = clerkError?.errors?.[0]?.code ?? '';
                if (errCode === 'form_identifier_not_found') {
                    // First-time Clerk user — sign up and send OTP
                    try {
                        const nameParts = clientName.trim().split(/\s+/);
                        const firstName = nameParts[0] || email.trim().split('@')[0];
                        const lastName = nameParts.slice(1).join(' ') || '.';
                        await signUp!.create({ emailAddress: email.trim(), firstName, lastName });
                        await signUp!.prepareEmailAddressVerification({ strategy: 'email_code' });
                        router.push({ pathname: '/(auth)/verify', params: { email: email.trim(), flow: 'signUp' } });
                    } catch (signUpError: unknown) {
                        const signUpClerkError = signUpError as { errors?: { code: string; message: string }[] };
                        const signUpErrCode = signUpClerkError?.errors?.[0]?.code ?? '';
                        // Clerk user already exists (e.g. from a previous incomplete signup) — retry as signIn
                        if (signUpErrCode === 'form_email_address_exists' || signUpErrCode === 'identifier_already_signed_up') {
                            await signIn!.create({
                                identifier: email.trim(),
                                strategy: 'email_code',
                            });
                            router.push({ pathname: '/(auth)/verify', params: { email: email.trim(), flow: 'signIn' } });
                        } else {
                            throw signUpError;
                        }
                    }
                } else {
                    throw signInError;
                }
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to send OTP. Please try again.';
            showToast({ title: 'Error', message, variant: 'error' });
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
