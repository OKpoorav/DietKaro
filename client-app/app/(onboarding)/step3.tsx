import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { AlertTriangle, Plus, X } from 'lucide-react-native';

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
                        <Plus size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {allergies.length > 0 && (
                <View style={styles.summary}>
                    <View style={styles.warningIcon}>
                        <AlertTriangle size={20} color="#ef4444" />
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
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        color: '#333',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#eee',
    },
    selectedChip: {
        backgroundColor: '#fee2e2',
        borderColor: '#ef4444',
    },
    chipText: {
        color: '#666',
        fontWeight: '500',
    },
    selectedChipText: {
        color: '#ef4444',
        fontWeight: '600',
    },
    inputContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        backgroundColor: '#f9f9f9',
    },
    addButton: {
        width: 50,
        height: 50,
        borderRadius: 12,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    summary: {
        flexDirection: 'row',
        backgroundColor: '#fef2f2',
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
        marginBottom: 24,
        alignItems: 'center',
    },
    warningIcon: {
        marginRight: 12,
    },
    summaryText: {
        flex: 1,
        color: '#b91c1c',
        fontSize: 14,
        lineHeight: 20,
    },
    button: {
        backgroundColor: '#17cf54',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    }
});
