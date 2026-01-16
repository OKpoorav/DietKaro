import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <View style={styles.loader}>
                <ActivityIndicator size="large" color="#17cf54" />
            </View>
        );
    }

    if (isAuthenticated) {
        return <Redirect href="/(tabs)/home" />;
    }

    return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
});
