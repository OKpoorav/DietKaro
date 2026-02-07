// DietConnect Design Theme Constants
// Based on Figma design reference

import { StyleSheet } from 'react-native';

export const Colors = {
    // Primary colors
    primary: '#13ec5b',      // Bright green - main accent
    primaryDark: '#17cf54',  // Slightly darker green

    // Background colors
    background: '#f8fcf9',   // Light mint background
    surface: '#ffffff',      // White cards/surfaces
    surfaceSecondary: '#e7f3eb', // Light green surface

    // Text colors
    text: '#0d1b12',         // Dark green-black text
    textSecondary: '#4c9a66', // Muted green text
    textMuted: '#6b7280',    // Gray text

    // Border colors
    border: '#cfe7d7',       // Light green border
    borderLight: '#e7f3eb',  // Very light border

    // Status colors
    success: '#17cf54',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#6366f1',

    // Tab bar
    tabActive: '#0d1b12',
    tabInactive: '#4c9a66',
    tabBackground: '#f8fcf9',
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
};

export const BorderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
};

export const FontSizes = {
    xs: 12,
    sm: 13,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 22,
    xxxl: 28,
    display: 32,
};

export const FontWeights = {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
};

// Shadow presets
export const Shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
};

/** Meal status color presets */
export const StatusColors = {
    pending: { bg: '#fef3c7', text: '#92400e', label: 'Pending' },
    eaten: { bg: '#d1fae5', text: '#065f46', label: 'Logged' },
    skipped: { bg: '#fee2e2', text: '#991b1b', label: 'Skipped' },
    substituted: { bg: '#dbeafe', text: '#1e40af', label: 'Substituted' },
    underReview: { bg: '#fef3c7', text: '#92400e', label: 'Under Review' },
    reviewed: { bg: '#ede9fe', text: '#5b21b6', label: 'Reviewed' },
} as const;

/** Common style presets used across screens */
export const CommonStyles = StyleSheet.create({
    screenContainer: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    card: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.lg,
        ...Shadows.md,
    },
    primaryButton: {
        backgroundColor: Colors.primary,
        height: 56,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    primaryButtonDisabled: {
        backgroundColor: Colors.border,
    },
    primaryButtonText: {
        color: Colors.text,
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.bold,
    },
    sectionTitle: {
        fontSize: FontSizes.xxl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
    },
});
