import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../constants/theme';

interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    action?: {
        label: string;
        onPress: () => void;
    };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
    return (
        <View style={styles.container}>
            {icon}
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            {action && (
                <TouchableOpacity style={styles.actionButton} onPress={action.onPress}>
                    <Text style={styles.actionText}>{action.label}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 48,
        paddingHorizontal: Spacing.xxxl,
    },
    title: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
        marginTop: Spacing.lg,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.sm,
        lineHeight: 20,
    },
    actionButton: {
        marginTop: Spacing.lg,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.xxl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    actionText: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.bold,
        color: Colors.text,
    },
});
