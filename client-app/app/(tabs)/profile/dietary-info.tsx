import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ArrowLeft, Leaf, Fish, Egg, Plus, AlertTriangle, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../../constants/theme';
import { onboardingApi } from '../../../services/api';
import { useToast } from '../../../components/Toast';

const DIET_PATTERNS = [
    { id: 'vegetarian', name: 'Vegetarian', icon: Leaf, desc: 'No meat, fish, or poultry. Dairy allowed.' },
    { id: 'vegan', name: 'Vegan', icon: Leaf, desc: 'Plant-based only. No animal products.' },
    { id: 'non_veg', name: 'Non-Vegetarian', icon: Fish, desc: 'Includes meat, fish, and poultry.' },
    { id: 'eggetarian', name: 'Eggetarian', icon: Egg, desc: 'Vegetarian + Eggs.' },
    { id: 'pescatarian', name: 'Pescatarian', icon: Fish, desc: 'Vegetarian + Fish/Seafood.' },
];

const COMMON_ALLERGENS = [
    'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Wheat', 'Soy', 'Fish', 'Shellfish'
];

const COMMON_DISLIKES = [
    'Mushrooms', 'Eggplant', 'Bitter Gourd', 'Okra', 'Seafood', 'Coriander', 'Papaya'
];

const COMMON_LIKED_FOODS = [
    'Paneer', 'Chicken', 'Rice', 'Dal', 'Roti', 'Eggs', 'Fish', 'Salad'
];

const CUISINES = [
    'North Indian', 'South Indian', 'Chinese', 'Continental', 'Mediterranean', 'Bengali', 'Gujarati', 'Punjabi'
];

export default function DietaryInfoScreen() {
    const router = useRouter();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Step 2: Diet pattern
    const [dietPattern, setDietPattern] = useState('vegetarian');
    const [eggAllowed, setEggAllowed] = useState(false);

    // Step 3: Allergies
    const [allergies, setAllergies] = useState<string[]>([]);
    const [customAllergy, setCustomAllergy] = useState('');
    const [intolerances, setIntolerances] = useState<string[]>([]);

    // Step 5: Preferences
    const [dislikes, setDislikes] = useState<string[]>([]);
    const [customDislike, setCustomDislike] = useState('');
    const [likedFoods, setLikedFoods] = useState<string[]>([]);
    const [preferredCuisines, setPreferredCuisines] = useState<string[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const response = await onboardingApi.getStatus();
            const { stepsData } = response.data.data;

            // Step 2
            if (stepsData.step2) {
                setDietPattern(stepsData.step2.dietPattern || 'vegetarian');
                setEggAllowed(stepsData.step2.eggAllowed ?? false);
            }

            // Step 3
            if (stepsData.step3) {
                setAllergies(stepsData.step3.allergies || []);
                setIntolerances(stepsData.step3.intolerances || []);
            }

            // Step 5
            if (stepsData.step5) {
                setDislikes(stepsData.step5.dislikes || []);
                setLikedFoods(stepsData.step5.likedFoods || []);
                setPreferredCuisines(stepsData.step5.preferredCuisines || []);
            }
        } catch (error) {
            // First time or error — use defaults
        } finally {
            setLoading(false);
        }
    };

    const toggleItem = (list: string[], setList: (items: string[]) => void, item: string) => {
        if (list.includes(item)) {
            setList(list.filter(i => i !== item));
        } else {
            setList([...list, item]);
        }
    };

    const addCustomAllergy = () => {
        if (customAllergy.trim() && !allergies.includes(customAllergy.trim())) {
            setAllergies([...allergies, customAllergy.trim()]);
            setCustomAllergy('');
        }
    };

    const addCustomDislike = () => {
        if (customDislike.trim() && !dislikes.includes(customDislike.trim())) {
            setDislikes([...dislikes, customDislike.trim()]);
            setCustomDislike('');
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onboardingApi.saveStep(2, {
                dietPattern,
                eggAllowed: dietPattern === 'vegetarian' ? eggAllowed : dietPattern === 'eggetarian',
            });
            await onboardingApi.saveStep(3, { allergies, intolerances });
            await onboardingApi.saveStep(5, { dislikes, likedFoods, preferredCuisines });

            toast.showToast({ title: 'Saved', message: 'Your dietary info has been updated.', variant: 'success' });
        } catch (error) {
            Alert.alert('Error', 'Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primaryDark} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Dietary Info</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

                {/* Section 1: Diet Pattern */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Diet Pattern</Text>
                    <View style={styles.patterns}>
                        {DIET_PATTERNS.map((pattern) => (
                            <TouchableOpacity
                                key={pattern.id}
                                style={[
                                    styles.patternCard,
                                    dietPattern === pattern.id && styles.selectedCard
                                ]}
                                onPress={() => setDietPattern(pattern.id)}
                            >
                                <View style={styles.patternIcon}>
                                    <pattern.icon size={22} color={dietPattern === pattern.id ? Colors.primaryDark : Colors.textMuted} />
                                </View>
                                <View style={styles.patternText}>
                                    <Text style={[
                                        styles.patternName,
                                        dietPattern === pattern.id && styles.selectedText
                                    ]}>{pattern.name}</Text>
                                    <Text style={styles.patternDesc}>{pattern.desc}</Text>
                                </View>
                                <View style={[
                                    styles.radio,
                                    dietPattern === pattern.id && styles.selectedRadio
                                ]} />
                            </TouchableOpacity>
                        ))}
                    </View>

                    {dietPattern === 'vegetarian' && (
                        <View style={styles.eggOption}>
                            <Text style={styles.eggLabel}>Do you eat eggs?</Text>
                            <Switch
                                value={eggAllowed}
                                onValueChange={setEggAllowed}
                                trackColor={{ false: Colors.border, true: Colors.primaryDark }}
                                thumbColor={Colors.surface}
                            />
                        </View>
                    )}
                </View>

                {/* Section 2: Allergies */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Allergies & Intolerances</Text>
                    <Text style={styles.sectionSubtitle}>Select any foods you're allergic to</Text>

                    <View style={styles.chipContainer}>
                        {COMMON_ALLERGENS.map((item) => (
                            <TouchableOpacity
                                key={item}
                                style={[styles.chip, allergies.includes(item) && styles.chipAllergy]}
                                onPress={() => toggleItem(allergies, setAllergies, item)}
                            >
                                <Text style={[styles.chipText, allergies.includes(item) && styles.chipAllergyText]}>
                                    {item}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.textInput}
                            value={customAllergy}
                            onChangeText={setCustomAllergy}
                            placeholder="Add other allergy..."
                            placeholderTextColor={Colors.textMuted}
                            onSubmitEditing={addCustomAllergy}
                        />
                        <TouchableOpacity style={styles.addButton} onPress={addCustomAllergy}>
                            <Plus size={20} color={Colors.surface} />
                        </TouchableOpacity>
                    </View>

                    {allergies.length > 0 && (
                        <View style={styles.warningBanner}>
                            <AlertTriangle size={18} color={Colors.error} />
                            <Text style={styles.warningText}>
                                Excluding: {allergies.join(', ')}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Section 3: Food Preferences */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <ThumbsDown size={18} color={Colors.textMuted} />
                        <Text style={styles.sectionTitle}>Foods You Dislike</Text>
                    </View>
                    <View style={styles.chipContainer}>
                        {COMMON_DISLIKES.map((item) => (
                            <TouchableOpacity
                                key={item}
                                style={[styles.chip, dislikes.includes(item) && styles.chipDislike]}
                                onPress={() => toggleItem(dislikes, setDislikes, item)}
                            >
                                <Text style={[styles.chipText, dislikes.includes(item) && styles.chipDislikeText]}>
                                    {item}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.textInput}
                            value={customDislike}
                            onChangeText={setCustomDislike}
                            placeholder="Add other..."
                            placeholderTextColor={Colors.textMuted}
                            onSubmitEditing={addCustomDislike}
                        />
                        <TouchableOpacity style={styles.addButton} onPress={addCustomDislike}>
                            <Plus size={20} color={Colors.surface} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <ThumbsUp size={18} color={Colors.primaryDark} />
                        <Text style={styles.sectionTitle}>Foods You Enjoy</Text>
                    </View>
                    <View style={styles.chipContainer}>
                        {COMMON_LIKED_FOODS.map((item) => (
                            <TouchableOpacity
                                key={item}
                                style={[styles.chip, likedFoods.includes(item) && styles.chipLike]}
                                onPress={() => toggleItem(likedFoods, setLikedFoods, item)}
                            >
                                <Text style={[styles.chipText, likedFoods.includes(item) && styles.chipLikeText]}>
                                    {item}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferred Cuisines</Text>
                    <View style={styles.chipContainer}>
                        {CUISINES.map((item) => (
                            <TouchableOpacity
                                key={item}
                                style={[styles.chip, preferredCuisines.includes(item) && styles.chipLike]}
                                onPress={() => toggleItem(preferredCuisines, setPreferredCuisines, item)}
                            >
                                <Text style={[styles.chipText, preferredCuisines.includes(item) && styles.chipLikeText]}>
                                    {item}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color={Colors.surface} />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
    },
    section: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    sectionSubtitle: {
        fontSize: FontSizes.sm,
        color: Colors.textMuted,
        marginBottom: Spacing.md,
    },
    // Diet pattern cards
    patterns: {
        gap: Spacing.sm,
    },
    patternCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.borderLight,
    },
    selectedCard: {
        borderColor: Colors.primaryDark,
        backgroundColor: Colors.surfaceSecondary,
    },
    patternIcon: {
        marginRight: Spacing.md,
    },
    patternText: {
        flex: 1,
    },
    patternName: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
    },
    selectedText: {
        color: Colors.primaryDark,
    },
    patternDesc: {
        fontSize: FontSizes.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },
    radio: {
        width: 18,
        height: 18,
        borderRadius: 9,
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
        marginTop: Spacing.lg,
        padding: Spacing.md,
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.md,
    },
    eggLabel: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.medium,
        color: Colors.text,
    },
    // Chips
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    chip: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: 10,
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.borderLight,
    },
    chipText: {
        color: Colors.textMuted,
        fontWeight: FontWeights.medium,
        fontSize: FontSizes.sm,
    },
    chipAllergy: {
        backgroundColor: '#fee2e2',
        borderColor: Colors.error,
    },
    chipAllergyText: {
        color: Colors.error,
        fontWeight: FontWeights.semibold,
    },
    chipDislike: {
        backgroundColor: '#e5e7eb',
        borderColor: '#9ca3af',
    },
    chipDislikeText: {
        color: '#111',
        fontWeight: FontWeights.semibold,
    },
    chipLike: {
        backgroundColor: Colors.surfaceSecondary,
        borderColor: Colors.primaryDark,
    },
    chipLikeText: {
        color: Colors.primaryDark,
        fontWeight: FontWeights.semibold,
    },
    // Input row
    inputRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    textInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        backgroundColor: Colors.background,
        color: Colors.text,
    },
    addButton: {
        width: 48,
        height: 48,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.text,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Warning
    warningBanner: {
        flexDirection: 'row',
        backgroundColor: '#fef2f2',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.md,
        alignItems: 'center',
        gap: Spacing.sm,
    },
    warningText: {
        flex: 1,
        color: '#b91c1c',
        fontSize: FontSizes.sm,
        lineHeight: 20,
    },
    // Save button
    saveButton: {
        backgroundColor: Colors.primaryDark,
        padding: Spacing.xl,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        marginTop: Spacing.sm,
        shadowColor: Colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: Colors.surface,
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
    },
});
