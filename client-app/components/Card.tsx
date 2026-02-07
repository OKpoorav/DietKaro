import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, BorderRadius, Spacing, Shadows } from '../constants/theme';

interface CardProps {
    children: React.ReactNode;
    variant?: 'default' | 'elevated';
    style?: StyleProp<ViewStyle>;
    padding?: number;
}

export function Card({ children, variant = 'default', style, padding }: CardProps) {
    return (
        <View
            style={[
                styles.base,
                variant === 'elevated' && styles.elevated,
                padding !== undefined && { padding },
                style,
            ]}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.lg,
        ...Shadows.md,
    },
    elevated: {
        borderWidth: 0,
        ...Shadows.lg,
    },
});
