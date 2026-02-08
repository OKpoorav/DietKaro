import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ThumbsDown, ThumbsUp, Plus } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';
import { onboardingApi } from '../../services/api';

const COMMON_DISLIKES = [
    'Mushrooms', 'Eggplant', 'Bitter Gourd', 'Okra', 'Seafood', 'Coriander', 'Papaya'
];

const COMMON_LIKED_FOODS = [
    'Paneer', 'Chicken', 'Rice', 'Dal', 'Roti', 'Eggs', 'Fish', 'Salad'
];

const CUISINES = [
    'North Indian', 'South Indian', 'Chinese', 'Continental', 'Mediterranean', 'Bengali', 'Gujarati', 'Punjabi'
];

export default function PreferencesScreen() {
    const router = useRouter();
    const [dislikes, setDislikes] = useState<string[]>([]);
    const [customDislike, setCustomDislike] = useState('');
    const [likedFoods, setLikedFoods] = useState<string[]>([]);
    const [preferredCuisines, setPreferredCuisines] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    const toggleItem = (list: string[], setList: (items: string[]) => void, item: string) => {
        if (list.includes(item)) {
            setList(list.filter(i => i !== item));
        } else {
            setList([...list, item]);
        }
    };

    const addCustomDislike = () => {
        if (customDislike && !dislikes.includes(customDislike)) {
            setDislikes([...dislikes, customDislike]);
            setCustomDislike('');
        }
    };

    const handleNext = async () => {
        setSaving(true);
        try {
            await onboardingApi.saveStep(5, {
                dislikes,
                likedFoods,
                preferredCuisines,
            });
            router.push('/(onboarding)/step6');
        } catch (error) {
            Alert.alert('Error', 'Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Preferences</Text>
            <Text style={styles.subtitle}>Tell us what you like and dislike so we can personalize your meal plan.</Text>

            {/* Dislikes */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <ThumbsDown size={18} color={Colors.textMuted} />
                    <Text style={styles.sectionTitle}>Foods You Dislike</Text>
                </View>
                <View style={styles.chipContainer}>
                    {COMMON_DISLIKES.map((item) => (
                        <TouchableOpacity
                            key={item}
                            style={[
                                styles.chip,
                                dislikes.includes(item) && styles.selectedChipDislike
                            ]}
                            onPress={() => toggleItem(dislikes, setDislikes, item)}
                        >
                            <Text style={[
                                styles.chipText,
                                dislikes.includes(item) && styles.selectedChipTextDislike
                            ]}>{item}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={customDislike}
                        onChangeText={setCustomDislike}
                        placeholder="Add other..."
                        onSubmitEditing={addCustomDislike}
                    />
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={addCustomDislike}
                    >
                        <Plus size={20} color={Colors.surface} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Liked Foods */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <ThumbsUp size={18} color={Colors.primaryDark} />
                    <Text style={styles.sectionTitle}>Foods You Enjoy</Text>
                </View>
                <View style={styles.chipContainer}>
                    {COMMON_LIKED_FOODS.map((item) => (
                        <TouchableOpacity
                            key={item}
                            style={[
                                styles.chip,
                                likedFoods.includes(item) && styles.selectedChipLike
                            ]}
                            onPress={() => toggleItem(likedFoods, setLikedFoods, item)}
                        >
                            <Text style={[
                                styles.chipText,
                                likedFoods.includes(item) && styles.selectedChipTextLike
                            ]}>{item}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Preferred Cuisines */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Preferred Cuisines</Text>
                <View style={styles.chipContainer}>
                    {CUISINES.map((item) => (
                        <TouchableOpacity
                            key={item}
                            style={[
                                styles.chip,
                                preferredCuisines.includes(item) && styles.selectedChipLike
                            ]}
                            onPress={() => toggleItem(preferredCuisines, setPreferredCuisines, item)}
                        >
                            <Text style={[
                                styles.chipText,
                                preferredCuisines.includes(item) && styles.selectedChipTextLike
                            ]}>{item}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <TouchableOpacity
                style={[styles.button, saving && styles.buttonDisabled]}
                onPress={handleNext}
                disabled={saving}
            >
                {saving ? (
                    <ActivityIndicator color={Colors.surface} />
                ) : (
                    <Text style={styles.buttonText}>Next Step</Text>
                )}
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
    },
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
    selectedChipDislike: {
        backgroundColor: '#e5e7eb',
        borderColor: '#9ca3af',
    },
    selectedChipTextDislike: {
        color: '#111',
        fontWeight: FontWeights.semibold,
    },
    selectedChipLike: {
        backgroundColor: Colors.surfaceSecondary,
        borderColor: Colors.primaryDark,
    },
    selectedChipTextLike: {
        color: Colors.primaryDark,
        fontWeight: FontWeights.semibold,
    },
    chipText: {
        color: Colors.textMuted,
        fontWeight: FontWeights.medium,
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
    button: {
        backgroundColor: Colors.primaryDark,
        padding: Spacing.xl,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        marginTop: Spacing.xl,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: Colors.surface,
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
    }
});
