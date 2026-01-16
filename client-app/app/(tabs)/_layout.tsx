import { View, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { BottomTabBar } from '../../components/BottomTabBar';

export default function TabsLayout() {
    return (
        <View style={styles.container}>
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
