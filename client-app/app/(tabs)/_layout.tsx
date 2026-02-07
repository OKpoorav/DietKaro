import { View, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { BottomTabBar } from '../../components/BottomTabBar';
import { OfflineBanner } from '../../components/OfflineBanner';

export default function TabsLayout() {
    return (
        <View style={styles.container}>
            <OfflineBanner />
            <View style={styles.content}>
                <Slot />
            </View>
            <BottomTabBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
});
