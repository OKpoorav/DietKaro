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
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { normalizeError } from '../../utils/errorHandler';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, CommonStyles } from '../../constants/theme';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export default function VerifyScreen() {
    const router = useRouter();
    const { phone } = useLocalSearchParams<{ phone: string }>();
    const { login, requestOTP } = useAuth();
    const { showToast } = useToast();
    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [isLoading, setIsLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
    const inputRefs = useRef<(TextInput | null)[]>([]);

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

        if (newOtp.every((digit) => digit) && newOtp.join('').length === OTP_LENGTH) {
            handleVerify(newOtp.join(''));
        }
    };

    const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (otpCode: string) => {
        if (!phone) return;

        setIsLoading(true);
        try {
            await login(phone, otpCode);
            router.replace('/(tabs)/home');
        } catch (error: unknown) {
            const appError = normalizeError(error);
            showToast({ title: appError.title, message: appError.message, variant: 'error' });
            setOtp(Array(OTP_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = useCallback(async () => {
        if (resendTimer > 0 || !phone) return;
        try {
            await requestOTP(phone);
            setResendTimer(RESEND_COOLDOWN);
            showToast({ title: 'OTP Sent', message: 'A new code has been sent to your phone', variant: 'success' });
        } catch (error: unknown) {
            const appError = normalizeError(error);
            showToast({ title: appError.title, message: appError.message, variant: 'error' });
        }
    }, [resendTimer, phone, requestOTP, showToast]);

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
                    <Text style={styles.title}>Verify OTP</Text>
                    <Text style={styles.subtitle}>
                        Enter the 6-digit code sent to{'\n'}
                        <Text style={styles.phone}>+91 {phone}</Text>
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
                    style={[CommonStyles.primaryButton, otp.some((d) => !d) && CommonStyles.primaryButtonDisabled]}
                    onPress={() => handleVerify(otp.join(''))}
                    disabled={isLoading || otp.some((d) => !d)}
                >
                    {isLoading ? (
                        <ActivityIndicator color={Colors.text} />
                    ) : (
                        <Text style={CommonStyles.primaryButtonText}>Verify & Continue</Text>
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
    phone: {
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
