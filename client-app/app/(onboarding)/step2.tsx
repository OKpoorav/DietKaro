import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Shield, Fish, Egg, Leaf } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';

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
                            <pattern.icon size={24} color={selectedPattern === pattern.id ? Colors.primaryDark : Colors.textMuted} />
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
                        trackColor={{ false: Colors.borderLight, true: Colors.primaryDark }}
                        thumbColor={Colors.surface}
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
        backgroundColor: Colors.surface,
    },
    content: {
        padding: Spacing.xxl,
    },
    title: {
        fontSize: 24,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: FontSizes.lg,
        color: Colors.textMuted,
        marginBottom: Spacing.xxxl,
        lineHeight: 22,
    },
    patterns: {
        gap: Spacing.md,
    },
    patternCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.borderLight,
        backgroundColor: Colors.surface,
    },
    selectedCard: {
        borderColor: Colors.primaryDark,
        backgroundColor: Colors.surfaceSecondary,
    },
    iconContainer: {
        marginRight: Spacing.lg,
    },
    textContainer: {
        flex: 1,
    },
    patternName: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
        marginBottom: Spacing.xs,
    },
    selectedText: {
        color: Colors.primaryDark,
    },
    patternDesc: {
        fontSize: FontSizes.xs,
        color: Colors.textMuted,
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: Colors.border,
    },
    selectedRadio: {
        borderColor: Colors.primaryDark,
        backgroundColor: Colors.primaryDark,
    },
    eggOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.xxl,
        padding: Spacing.lg,
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.md,
    },
    eggLabel: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.medium,
        color: Colors.text,
    },
    button: {
        backgroundColor: Colors.primaryDark,
        padding: Spacing.xl,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        marginTop: Spacing.xxxl,
        shadowColor: Colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: Colors.surface,
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
    }
});
