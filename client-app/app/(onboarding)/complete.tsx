import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';

export default function CompleteScreen() {
    const router = useRouter();

    const handleStart = () => {
        router.replace('/(tabs)');
    };

    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <CheckCircle size={80} color="#17cf54" />
            </View>

            <Text style={styles.title}>All Set!</Text>
            <Text style={styles.subtitle}>
                Your profile has been set up. Your dietitian will now create a personalized plan for you based on these preferences.
            </Text>

            <TouchableOpacity
                style={styles.button}
                onPress={handleStart}
            >
                <Text style={styles.buttonText}>Go to Dashboard</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    iconContainer: {
        marginBottom: 32,
        shadowColor: '#17cf54',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 16,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 48,
        textAlign: 'center',
        lineHeight: 24,
    },
    button: {
        backgroundColor: '#17cf54',
        paddingVertical: 18,
        paddingHorizontal: 32,
        borderRadius: 12,
        alignItems: 'center',
        width: '100%',
        shadowColor: '#17cf54',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    }
});
