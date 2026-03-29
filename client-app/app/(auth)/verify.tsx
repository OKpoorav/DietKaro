import { useState, useRef, useEffect, useCallback } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, ArrowLeft } from 'lucide-react-native';
import { useSignIn, useSignUp, useAuth as useClerkAuth } from '@clerk/clerk-expo';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, CommonStyles } from '../../constants/theme';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export default function VerifyScreen() {
    const router = useRouter();
    const { email, flow } = useLocalSearchParams<{ email: string; flow: 'signIn' | 'signUp' }>();
    const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
    const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
    const { getToken } = useClerkAuth();
    const isLoaded = signInLoaded && signUpLoaded;
    const { login } = useAuth();
    const { showToast } = useToast();
    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [isLoading, setIsLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
    const [isVerified, setIsVerified] = useState(false);
    const inputRefs = useRef<(TextInput | null)[]>([]);
    const isVerifyingRef = useRef(false);
    // After Clerk verifies, store the token so backend login can be retried without re-verifying
    const pendingClerkTokenRef = useRef<string | null>(null);

    // Resend countdown timer
    useEffect(() => {
        if (resendTimer <= 0) return;
        const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendTimer]);

    const handleOtpChange = (value: string, index: number) => {
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        if (!isLoading && !isVerified && newOtp.every((digit) => digit) && newOtp.join('').length === OTP_LENGTH) {
            handleVerify(newOtp.join(''));
        }
    };

    const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const completeBackendLogin = async (clerkToken: string) => {
        await login(clerkToken);
        pendingClerkTokenRef.current = null;
        router.replace('/(tabs)/home');
    };

    const handleVerify = async (otpCode: string) => {
        if (!isLoaded || isVerifyingRef.current) return;

        isVerifyingRef.current = true;
        setIsLoading(true);
        try {
            // If Clerk already verified but backend failed, skip re-verification and retry backend
            if (pendingClerkTokenRef.current) {
                await completeBackendLogin(pendingClerkTokenRef.current);
                return;
            }

            let status: string;

            if (flow === 'signUp') {
                const result = await signUp!.attemptEmailAddressVerification({ code: otpCode });
                status = result.status ?? '';
                if (status === 'complete') {
                    await setSignUpActive!({ session: result.createdSessionId });
                }
            } else {
                const result = await signIn!.attemptFirstFactor({ strategy: 'email_code', code: otpCode });
                status = result.status ?? '';
                if (status === 'complete') {
                    await setSignInActive!({ session: result.createdSessionId });
                }
            }

            if (status === 'complete') {
                // Mark as verified immediately so duplicate taps don't re-call Clerk
                setIsVerified(true);

                // getToken() can return null briefly after setActive() on physical devices — retry longer
                let clerkToken: string | null = null;
                for (let i = 0; i < 10; i++) {
                    clerkToken = await getToken();
                    if (clerkToken) break;
                    await new Promise((r) => setTimeout(r, 500));
                }
                if (!clerkToken) throw new Error('Failed to get session token. Please try again.');
                pendingClerkTokenRef.current = clerkToken;
                await completeBackendLogin(clerkToken);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Invalid or expired code';
            // Only clear OTP for Clerk errors, not backend errors
            if (!pendingClerkTokenRef.current) {
                setIsVerified(false);
                showToast({ title: 'Verification Failed', message, variant: 'error' });
                setOtp(Array(OTP_LENGTH).fill(''));
                inputRefs.current[0]?.focus();
            } else {
                showToast({ title: 'Login Failed', message: 'Could not reach server. Tap "Retry Login" to try again.', variant: 'error' });
            }
        } finally {
            isVerifyingRef.current = false;
            // Keep loading state if verified — we're navigating away
            if (!pendingClerkTokenRef.current) {
                setIsLoading(false);
            }
        }
    };

    const handleResend = useCallback(async () => {
        if (resendTimer > 0 || !isLoaded || !email) return;
        try {
            if (flow === 'signUp') {
                await signUp!.prepareEmailAddressVerification({ strategy: 'email_code' });
            } else {
                await signIn!.create({ identifier: email, strategy: 'email_code' });
            }
            setResendTimer(RESEND_COOLDOWN);
            showToast({ title: 'OTP Sent', message: 'A new code has been sent to your email', variant: 'success' });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to resend code';
            showToast({ title: 'Error', message, variant: 'error' });
        }
    }, [resendTimer, email, flow, isLoaded, signIn, signUp, showToast]);

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <ArrowLeft size={24} color={Colors.text} />
            </TouchableOpacity>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <ShieldCheck size={32} color={Colors.primary} />
                    </View>
                    <Text style={styles.title}>Check your email</Text>
                    <Text style={styles.subtitle}>
                        Enter the 6-digit code sent to{'\n'}
                        <Text style={styles.emailText}>{email}</Text>
                    </Text>
                </View>

                <View style={styles.otpContainer}>
                    {otp.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={(ref) => { inputRefs.current[index] = ref; }}
                            style={[styles.otpInput, digit && styles.otpInputFilled]}
                            value={digit}
                            onChangeText={(value) => handleOtpChange(value.slice(-1), index)}
                            onKeyPress={(e) => handleKeyPress(e, index)}
                            keyboardType="number-pad"
                            maxLength={1}
                            selectTextOnFocus
                        />
                    ))}
                </View>

                <TouchableOpacity
                    style={[CommonStyles.primaryButton, (otp.some((d) => !d) || (isVerified && !pendingClerkTokenRef.current)) && CommonStyles.primaryButtonDisabled]}
                    onPress={() => handleVerify(otp.join(''))}
                    disabled={isLoading || otp.some((d) => !d) || (isVerified && !pendingClerkTokenRef.current)}
                >
                    {isLoading ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <ActivityIndicator color={Colors.text} />
                            {isVerified && <Text style={CommonStyles.primaryButtonText}>Logging in...</Text>}
                        </View>
                    ) : (
                        <Text style={CommonStyles.primaryButtonText}>
                        {pendingClerkTokenRef.current ? 'Retry Login' : 'Verify & Continue'}
                    </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleResend}
                    disabled={resendTimer > 0}
                >
                    <Text style={styles.resendText}>
                        {resendTimer > 0
                            ? `Resend code in ${resendTimer}s`
                            : "Didn't receive code? "}
                        {resendTimer <= 0 && <Text style={styles.resendLink}>Resend</Text>}
                    </Text>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    backButton: {
        padding: Spacing.lg,
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
    },
    subtitle: {
        fontSize: FontSizes.lg,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    emailText: {
        color: Colors.text,
        fontWeight: FontWeights.semibold,
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.md,
        marginBottom: Spacing.xxxl,
    },
    otpInput: {
        width: 48,
        height: 56,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surface,
        fontSize: 24,
        fontWeight: FontWeights.bold,
        textAlign: 'center',
        color: Colors.text,
    },
    otpInputFilled: {
        borderColor: Colors.primary,
        backgroundColor: Colors.surfaceSecondary,
    },
    resendButton: {
        marginTop: Spacing.xxl,
        alignItems: 'center',
    },
    resendText: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
    },
    resendLink: {
        color: Colors.primary,
        fontWeight: FontWeights.semibold,
    },
});
