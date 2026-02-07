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
import { Phone } from 'lucide-react-native';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { normalizeError } from '../../utils/errorHandler';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, CommonStyles } from '../../constants/theme';

export default function LoginScreen() {
    const router = useRouter();
    const { requestOTP } = useAuth();
    const { showToast } = useToast();
    const [phone, setPhone] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isValidPhone = /^\d{10}$/.test(phone);

    const handleRequestOTP = async () => {
        if (!isValidPhone) {
            showToast({ title: 'Invalid Phone', message: 'Please enter a valid 10-digit phone number', variant: 'warning' });
            return;
        }

        setIsLoading(true);
        try {
            await requestOTP(phone);
            router.push({
                pathname: '/(auth)/verify',
                params: { phone },
            });
        } catch (error: unknown) {
            const appError = normalizeError(error);
            showToast({
                title: appError.title,
                message: appError.message,
                variant: 'error',
                action: appError.isRetryable ? { label: 'Retry', onPress: handleRequestOTP } : undefined,
            });
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
                        <Phone size={32} color={Colors.primary} />
                    </View>
                    <Text style={styles.title}>Welcome to DietConnect</Text>
                    <Text style={styles.subtitle}>
                        Enter your phone number to get started with your personalized diet plan
                    </Text>
                </View>

                <View style={styles.form}>
                    <Text style={styles.label}>Phone Number</Text>
                    <View style={styles.inputContainer}>
                        <Text style={styles.prefix}>+91</Text>
                        <TextInput
                            style={styles.input}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="9876543210"
                            placeholderTextColor={Colors.textSecondary}
                            keyboardType="phone-pad"
                            maxLength={10}
                            autoFocus
                        />
                    </View>

                    <TouchableOpacity
                        style={[CommonStyles.primaryButton, !isValidPhone && CommonStyles.primaryButtonDisabled]}
                        onPress={handleRequestOTP}
                        disabled={isLoading || !isValidPhone}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={Colors.text} />
                        ) : (
                            <Text style={CommonStyles.primaryButtonText}>Get OTP</Text>
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
    },
    prefix: {
        paddingHorizontal: Spacing.lg,
        fontSize: FontSizes.lg,
        color: Colors.text,
        fontWeight: FontWeights.medium,
    },
    input: {
        flex: 1,
        height: 56,
        fontSize: FontSizes.xl,
        color: Colors.text,
        letterSpacing: 1,
    },
    footer: {
        fontSize: FontSizes.xs,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
    },
});
