import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { AlertTriangle, Plus, X } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';

const COMMON_ALLERGENS = [
    'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Wheat', 'Soy', 'Fish', 'Shellfish'
];

export default function AllergiesScreen() {
    const router = useRouter();
    const [allergies, setAllergies] = useState<string[]>([]);
    const [customAllergy, setCustomAllergy] = useState('');
    const [intolerances, setIntolerances] = useState<string[]>([]);

    const toggleAllergy = (allergen: string) => {
        if (allergies.includes(allergen)) {
            setAllergies(allergies.filter(a => a !== allergen));
        } else {
            setAllergies([...allergies, allergen]);
        }
    };

    const addCustomAllergy = () => {
        if (customAllergy && !allergies.includes(customAllergy)) {
            setAllergies([...allergies, customAllergy]);
            setCustomAllergy('');
        }
    };

    const handleNext = async () => {
        // TODO: Save to API
        router.push('/(onboarding)/step4');
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Allergies & Intolerances</Text>
            <Text style={styles.subtitle}>Do you have any food allergies or intolerances we should know about?</Text>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Common Allergens</Text>
                <View style={styles.chipContainer}>
                    {COMMON_ALLERGENS.map((allergen) => (
                        <TouchableOpacity
                            key={allergen}
                            style={[
                                styles.chip,
                                allergies.includes(allergen) && styles.selectedChip
                            ]}
                            onPress={() => toggleAllergy(allergen)}
                        >
                            <Text style={[
                                styles.chipText,
                                allergies.includes(allergen) && styles.selectedChipText
                            ]}>{allergen}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Add Other Allergy</Text>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={customAllergy}
                        onChangeText={setCustomAllergy}
                        placeholder="e.g. Strawberries"
                        onSubmitEditing={addCustomAllergy}
                    />
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={addCustomAllergy}
                    >
                        <Plus size={20} color={Colors.surface} />
                    </TouchableOpacity>
                </View>
            </View>

            {allergies.length > 0 && (
                <View style={styles.summary}>
                    <View style={styles.warningIcon}>
                        <AlertTriangle size={20} color={Colors.error} />
                    </View>
                    <Text style={styles.summaryText}>
                        We will exclude foods containing: {allergies.join(', ')}
                    </Text>
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
    section: {
        marginBottom: Spacing.xxl,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
        marginBottom: Spacing.md,
        color: Colors.text,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    chip: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: 10,
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.borderLight,
    },
    selectedChip: {
        backgroundColor: '#fee2e2',
        borderColor: Colors.error,
    },
    chipText: {
        color: Colors.textMuted,
        fontWeight: FontWeights.medium,
    },
    selectedChipText: {
        color: Colors.error,
        fontWeight: FontWeights.semibold,
    },
    inputContainer: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        padding: 14,
        fontSize: FontSizes.lg,
        backgroundColor: Colors.background,
    },
    addButton: {
        width: 50,
        height: 50,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.text,
        justifyContent: 'center',
        alignItems: 'center',
    },
    summary: {
        flexDirection: 'row',
        backgroundColor: '#fef2f2',
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.sm,
        marginBottom: Spacing.xxl,
        alignItems: 'center',
    },
    warningIcon: {
        marginRight: Spacing.md,
    },
    summaryText: {
        flex: 1,
        color: '#b91c1c',
        fontSize: FontSizes.md,
        lineHeight: 20,
    },
    button: {
        backgroundColor: Colors.primaryDark,
        padding: Spacing.xl,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        marginTop: Spacing.xl,
    },
    buttonText: {
        color: Colors.surface,
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
    }
});
