import { useState, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../../hooks/useAuth';

// Figma Design Colors
const colors = {
    background: '#f8fcf9',
    primary: '#13ec5b',
    text: '#0d1b12',
    textSecondary: '#4c9a66',
    border: '#cfe7d7',
    surface: '#e7f3eb',
    white: '#ffffff',
};

const OTP_LENGTH = 6;

export default function VerifyScreen() {
    const router = useRouter();
    const { phone } = useLocalSearchParams<{ phone: string }>();
    const { login } = useAuth();
    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [isLoading, setIsLoading] = useState(false);
    const inputRefs = useRef<(TextInput | null)[]>([]);

    const handleOtpChange = (value: string, index: number) => {
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when complete
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
            const message = error instanceof Error ? error.message : 'Invalid OTP';
            Alert.alert('Verification Failed', message);
            setOtp(Array(OTP_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <ArrowLeft size={24} color={colors.text} />
            </TouchableOpacity>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <ShieldCheck size={32} color={colors.primary} />
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
                    style={[styles.button, otp.some((d) => !d) && styles.buttonDisabled]}
                    onPress={() => handleVerify(otp.join(''))}
                    disabled={isLoading || otp.some((d) => !d)}
                >
                    {isLoading ? (
                        <ActivityIndicator color={colors.text} />
                    ) : (
                        <Text style={styles.buttonText}>Verify & Continue</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.resendButton}>
                    <Text style={styles.resendText}>
                        Didn't receive code? <Text style={styles.resendLink}>Resend</Text>
                    </Text>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    backButton: {
        padding: 16,
    },
    content: {
        flex: 1,
        padding: 24,
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
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    phone: {
        color: colors.text,
        fontWeight: '600',
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 32,
    },
    otpInput: {
        width: 48,
        height: 56,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.white,
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        color: colors.text,
    },
    otpInputFilled: {
        borderColor: colors.primary,
        backgroundColor: colors.surface,
    },
    button: {
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonDisabled: {
        backgroundColor: colors.border,
    },
    buttonText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
    },
    resendButton: {
        marginTop: 24,
        alignItems: 'center',
    },
    resendText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    resendLink: {
        color: colors.primary,
        fontWeight: '600',
    },
});
