import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Colors, FontSizes, FontWeights, Spacing } from '../constants/theme';

export function OfflineBanner() {
    const { isConnected } = useNetworkStatus();

    if (isConnected) return null;

    return (
        <View style={styles.banner}>
            <WifiOff size={16} color={Colors.surface} />
            <Text style={styles.text}>No internet connection</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        backgroundColor: Colors.error,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
    },
    text: {
        color: Colors.surface,
        fontSize: FontSizes.sm,
        fontWeight: FontWeights.medium,
    },
});
