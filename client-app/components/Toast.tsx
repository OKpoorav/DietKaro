import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { X } from 'lucide-react-native';
import { Colors, FontSizes, FontWeights, BorderRadius, Spacing } from '../constants/theme';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastConfig {
    title: string;
    message?: string;
    variant: ToastVariant;
    duration?: number;
    action?: { label: string; onPress: () => void };
}

interface ToastContextValue {
    showToast: (config: ToastConfig) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within ToastProvider');
    return context;
}

const variantColors: Record<ToastVariant, { bg: string; border: string; text: string }> = {
    success: { bg: '#d1fae5', border: Colors.success, text: '#065f46' },
    error: { bg: '#fee2e2', border: Colors.error, text: '#991b1b' },
    warning: { bg: '#fef3c7', border: Colors.warning, text: '#92400e' },
    info: { bg: '#e0e7ff', border: Colors.info, text: '#3730a3' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toast, setToast] = useState<ToastConfig | null>(null);
    const translateY = useRef(new Animated.Value(-100)).current;
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const hideToast = useCallback(() => {
        Animated.timing(translateY, {
            toValue: -100,
            duration: 200,
            useNativeDriver: true,
        }).start(() => setToast(null));
    }, [translateY]);

    const showToast = useCallback((config: ToastConfig) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        setToast(config);
        Animated.timing(translateY, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();

        timeoutRef.current = setTimeout(hideToast, config.duration || 3000);
    }, [translateY, hideToast]);

    const colors = toast ? variantColors[toast.variant] : variantColors.info;

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toast && (
                <Animated.View
                    style={[
                        styles.container,
                        { backgroundColor: colors.bg, borderLeftColor: colors.border, transform: [{ translateY }] },
                    ]}
                >
                    <View style={styles.content}>
                        <Text style={[styles.title, { color: colors.text }]}>{toast.title}</Text>
                        {toast.message && (
                            <Text style={[styles.message, { color: colors.text }]}>{toast.message}</Text>
                        )}
                        {toast.action && (
                            <TouchableOpacity onPress={toast.action.onPress} style={styles.actionButton}>
                                <Text style={[styles.actionText, { color: colors.border }]}>
                                    {toast.action.label}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
                        <X size={16} color={colors.text} />
                    </TouchableOpacity>
                </Animated.View>
            )}
        </ToastContext.Provider>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: Spacing.lg,
        right: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderLeftWidth: 4,
        padding: Spacing.lg,
        flexDirection: 'row',
        alignItems: 'flex-start',
        zIndex: 9999,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.semibold,
    },
    message: {
        fontSize: FontSizes.sm,
        marginTop: Spacing.xs,
        lineHeight: 18,
    },
    actionButton: {
        marginTop: Spacing.sm,
    },
    actionText: {
        fontSize: FontSizes.sm,
        fontWeight: FontWeights.bold,
    },
    closeButton: {
        padding: Spacing.xs,
        marginLeft: Spacing.sm,
    },
});
