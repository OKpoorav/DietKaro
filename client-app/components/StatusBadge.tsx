import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusColors, BorderRadius, FontSizes, FontWeights, Spacing } from '../constants/theme';

interface StatusBadgeProps {
    status: keyof typeof StatusColors;
    size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
    const config = StatusColors[status];
    const isSmall = size === 'sm';

    return (
        <View style={[
            styles.badge,
            { backgroundColor: config.bg },
            isSmall ? styles.badgeSm : styles.badgeMd,
        ]}>
            <Text style={[
                styles.text,
                { color: config.text },
                isSmall ? styles.textSm : styles.textMd,
            ]}>
                {config.label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        borderRadius: BorderRadius.md,
        alignSelf: 'flex-start',
    },
    badgeSm: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
    },
    badgeMd: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    text: {
        fontWeight: FontWeights.semibold,
    },
    textSm: {
        fontSize: FontSizes.xs,
    },
    textMd: {
        fontSize: FontSizes.sm,
    },
});
