import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Calendar, Apple } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';

const PRESETS = [
    {
        id: 'hindu_fasting_no_meat',
        name: 'Hindu Fasting',
        desc: 'No non-veg on Tuesday & Thursday',
        days: ['Tue', 'Thu']
    },
    {
        id: 'catholic_friday',
        name: 'Catholic Friday',
        desc: 'No meat on Fridays',
        days: ['Fri']
    },
    {
        id: 'jain_strict',
        name: 'Jain Diet',
        desc: 'No root vegetables, onion, garlic',
        days: ['Daily']
    }
];

export default function RestrictionsScreen() {
    const router = useRouter();
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
    const [customFasting, setCustomFasting] = useState(false);

    const handleNext = async () => {
        // TODO: Save to API
        router.push('/(onboarding)/step5');
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Food Restrictions</Text>
            <Text style={styles.subtitle}>Do you have religious or customary fasting rules?</Text>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Common Presets</Text>
                <View style={styles.presets}>
                    {PRESETS.map((preset) => (
                        <TouchableOpacity
                            key={preset.id}
                            style={[
                                styles.card,
                                selectedPreset === preset.id && styles.selectedCard
                            ]}
                            onPress={() => setSelectedPreset(selectedPreset === preset.id ? null : preset.id)}
                        >
                            <View style={styles.cardHeader}>
                                <View style={[
                                    styles.iconBox,
                                    selectedPreset === preset.id && styles.selectedIconBox
                                ]}>
                                    <Apple size={20} color={selectedPreset === preset.id ? Colors.primaryDark : Colors.textMuted} />
                                </View>
                                <View style={styles.cardText}>
                                    <Text style={[
                                        styles.cardTitle,
                                        selectedPreset === preset.id && styles.selectedText
                                    ]}>{preset.name}</Text>
                                    <Text style={styles.cardDesc}>{preset.desc}</Text>
                                </View>
                                <View style={[
                                    styles.radio,
                                    selectedPreset === preset.id && styles.selectedRadio
                                ]} />
                            </View>
                            {selectedPreset === preset.id && (
                                <View style={styles.tagContainer}>
                                    {preset.days.map((day, i) => (
                                        <View key={i} style={styles.tag}>
                                            <Calendar size={12} color={Colors.primaryDark} />
                                            <Text style={styles.tagText}>{day}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>I have custom fasting days</Text>
                    <Switch
                        value={customFasting}
                        onValueChange={setCustomFasting}
                        trackColor={{ false: Colors.borderLight, true: Colors.primaryDark }}
                        thumbColor={Colors.surface}
                    />
                </View>
                {customFasting && (
                    <Text style={styles.hint}>You can configure specific days later in your profile.</Text>
                )}
            </View>

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
    presets: {
        gap: Spacing.md,
    },
    card: {
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
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    selectedIconBox: {
        backgroundColor: Colors.surface,
    },
    cardText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
        marginBottom: 2,
    },
    selectedText: {
        color: Colors.primaryDark,
    },
    cardDesc: {
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
    tagContainer: {
        flexDirection: 'row',
        marginTop: Spacing.md,
        gap: Spacing.sm,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.borderLight,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.surface,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: 6,
    },
    tagText: {
        fontSize: FontSizes.xs,
        color: Colors.primaryDark,
        fontWeight: FontWeights.medium,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.md,
    },
    toggleLabel: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.medium,
        color: Colors.text,
    },
    hint: {
        marginTop: Spacing.sm,
        fontSize: FontSizes.xs,
        color: Colors.textMuted,
        fontStyle: 'italic',
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
