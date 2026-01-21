import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Shield, Fish, Egg, Leaf } from 'lucide-react-native';

const DIET_PATTERNS = [
    { id: 'vegetarian', name: 'Vegetarian', icon: Leaf, desc: 'No meat, fish, or poultry. Dairy allowed.' },
    { id: 'vegan', name: 'Vegan', icon: Leaf, desc: 'Plant-based only. No animal products.' },
    { id: 'non_veg', name: 'Non-Vegetarian', icon: Fish, desc: 'Includes meat, fish, and poultry.' },
    { id: 'eggetarian', name: 'Eggetarian', icon: Egg, desc: 'Vegetarian + Eggs.' },
    { id: 'pescatarian', name: 'Pescatarian', icon: Fish, desc: 'Vegetarian + Fish/Seafood.' },
];

export default function DietPatternScreen() {
    const router = useRouter();
    const [selectedPattern, setSelectedPattern] = useState('vegetarian');
    const [eggAllowed, setEggAllowed] = useState(false);

    const handleNext = async () => {
        // TODO: Save to API
        router.push('/(onboarding)/step3');
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Your Diet Pattern</Text>
            <Text style={styles.subtitle}>Choose the pattern that best describes your typical eating habits.</Text>

            <View style={styles.patterns}>
                {DIET_PATTERNS.map((pattern) => (
                    <TouchableOpacity
                        key={pattern.id}
                        style={[
                            styles.patternCard,
                            selectedPattern === pattern.id && styles.selectedCard
                        ]}
                        onPress={() => setSelectedPattern(pattern.id)}
                    >
                        <View style={styles.iconContainer}>
                            <pattern.icon size={24} color={selectedPattern === pattern.id ? '#17cf54' : '#666'} />
                        </View>
                        <View style={styles.textContainer}>
                            <Text style={[
                                styles.patternName,
                                selectedPattern === pattern.id && styles.selectedText
                            ]}>{pattern.name}</Text>
                            <Text style={styles.patternDesc}>{pattern.desc}</Text>
                        </View>
                        <View style={[
                            styles.radio,
                            selectedPattern === pattern.id && styles.selectedRadio
                        ]} />
                    </TouchableOpacity>
                ))}
            </View>

            {selectedPattern === 'vegetarian' && (
                <View style={styles.eggOption}>
                    <Text style={styles.eggLabel}>Do you eat eggs?</Text>
                    <Switch
                        value={eggAllowed}
                        onValueChange={setEggAllowed}
                        trackColor={{ false: '#eee', true: '#17cf54' }}
                        thumbColor={'#fff'}
                    />
                </View>
            )}

            <TouchableOpacity
                style={styles.button}
                onPress={handleNext}
            >
                <Text style={styles.buttonText}>Next Step</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        padding: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 32,
        lineHeight: 22,
    },
    patterns: {
        gap: 12,
    },
    patternCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eee',
        backgroundColor: '#fff',
    },
    selectedCard: {
        borderColor: '#17cf54',
        backgroundColor: '#f0fdf4',
    },
    iconContainer: {
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
    },
    patternName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    selectedText: {
        color: '#17cf54',
    },
    patternDesc: {
        fontSize: 12,
        color: '#888',
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#ddd',
    },
    selectedRadio: {
        borderColor: '#17cf54',
        backgroundColor: '#17cf54',
    },
    eggOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 24,
        padding: 16,
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
    },
    eggLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    button: {
        backgroundColor: '#17cf54',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 32,
        shadowColor: '#17cf54',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    }
});
