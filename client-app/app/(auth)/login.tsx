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
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone } from 'lucide-react-native';
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

export default function LoginScreen() {
    const router = useRouter();
    const { requestOTP } = useAuth();
    const [phone, setPhone] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleRequestOTP = async () => {
        if (phone.length < 10) {
            Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number');
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
            const message = error instanceof Error ? error.message : 'Failed to send OTP';
            Alert.alert('Error', message);
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
                        <Phone size={32} color={colors.primary} />
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
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="phone-pad"
                            maxLength={10}
                            autoFocus
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, phone.length < 10 && styles.buttonDisabled]}
                        onPress={handleRequestOTP}
                        disabled={isLoading || phone.length < 10}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={colors.text} />
                        ) : (
                            <Text style={styles.buttonText}>Get OTP</Text>
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
        backgroundColor: colors.background,
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
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 16,
    },
    form: {
        marginBottom: 32,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.white,
        marginBottom: 24,
    },
    prefix: {
        paddingHorizontal: 16,
        fontSize: 16,
        color: colors.text,
        fontWeight: '500',
    },
    input: {
        flex: 1,
        height: 56,
        fontSize: 18,
        color: colors.text,
        letterSpacing: 1,
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
    footer: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
    },
});
