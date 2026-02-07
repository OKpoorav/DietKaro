import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ThumbsDown, Plus } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';

const COMMON_DISLIKES = [
    'Mushrooms', 'Eggplant', 'Bitter Gourd', 'Okra', 'Seafood', 'Coriander', 'Papaya'
];

export default function PreferencesScreen() {
    const router = useRouter();
    const [dislikes, setDislikes] = useState<string[]>([]);
    const [customDislike, setCustomDislike] = useState('');

    const toggleDislike = (item: string) => {
        if (dislikes.includes(item)) {
            setDislikes(dislikes.filter(i => i !== item));
        } else {
            setDislikes([...dislikes, item]);
        }
    };

    const addCustomDislike = () => {
        if (customDislike && !dislikes.includes(customDislike)) {
            setDislikes([...dislikes, customDislike]);
            setCustomDislike('');
        }
    };

    const handleFinish = async () => {
        // TODO: Save to API and Complete
        router.replace('/(onboarding)/complete');
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Preferences</Text>
            <Text style={styles.subtitle}>Any foods you absolutely dislike? We won't include them in your plan.</Text>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Common Dislikes</Text>
                <View style={styles.chipContainer}>
                    {COMMON_DISLIKES.map((item) => (
                        <TouchableOpacity
                            key={item}
                            style={[
                                styles.chip,
                                dislikes.includes(item) && styles.selectedChip
                            ]}
                            onPress={() => toggleDislike(item)}
                        >
                            <Text style={[
                                styles.chipText,
                                dislikes.includes(item) && styles.selectedChipText
                            ]}>{item}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Add Other Dislike</Text>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={customDislike}
                        onChangeText={setCustomDislike}
                        placeholder="e.g. Broccoli"
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

            {dislikes.length > 0 && (
                <View style={styles.summary}>
                    <View style={styles.iconBox}>
                        <ThumbsDown size={20} color={Colors.textMuted} />
                    </View>
                    <Text style={styles.summaryText}>
                        Avoiding: {dislikes.join(', ')}
                    </Text>
                </View>
            )}

            <TouchableOpacity
                style={styles.button}
                onPress={handleFinish}
            >
                <Text style={styles.buttonText}>Complete Setup</Text>
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
        backgroundColor: '#e5e7eb',
        borderColor: '#9ca3af',
    },
    chipText: {
        color: Colors.textMuted,
        fontWeight: FontWeights.medium,
    },
    selectedChipText: {
        color: '#111',
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
        backgroundColor: '#f9fafb',
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.sm,
        marginBottom: Spacing.xxl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    iconBox: {
        marginRight: Spacing.md,
    },
    summaryText: {
        flex: 1,
        color: '#4b5563',
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
