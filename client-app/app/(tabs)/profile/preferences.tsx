import { View, Text, StyleSheet, ScrollView, TextInput, Switch, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Clock, ChefHat, Activity, ArrowLeft } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../../constants/theme';
import { preferencesApi } from '../../../services/api';
import { useToast } from '../../../components/Toast';

const ACTIVITY_LEVELS = ['Sedentary', 'Light', 'Moderate', 'Active', 'Very Active'];

export default function PreferencesScreen() {
    const router = useRouter();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Meal timings
    const [breakfastTime, setBreakfastTime] = useState('');
    const [lunchTime, setLunchTime] = useState('');
    const [dinnerTime, setDinnerTime] = useState('');
    const [snackTime, setSnackTime] = useState('');

    // Kitchen & cooking
    const [canCook, setCanCook] = useState(true);
    const [kitchenAvailable, setKitchenAvailable] = useState(true);
    const [hasDietaryCook, setHasDietaryCook] = useState(false);

    // Lifestyle
    const [weekdayActivity, setWeekdayActivity] = useState('');
    const [weekendActivity, setWeekendActivity] = useState('');
    const [sportOrHobby, setSportOrHobby] = useState('');
    const [generalNotes, setGeneralNotes] = useState('');

    useEffect(() => {
        fetchPreferences();
    }, []);

    const fetchPreferences = async () => {
        try {
            const response = await preferencesApi.get();
            const prefs = response.data.data;
            if (prefs) {
                setBreakfastTime(prefs.breakfastTime || '');
                setLunchTime(prefs.lunchTime || '');
                setDinnerTime(prefs.dinnerTime || '');
                setSnackTime(prefs.snackTime || '');
                setCanCook(prefs.canCook);
                setKitchenAvailable(prefs.kitchenAvailable);
                setHasDietaryCook(prefs.hasDietaryCook);
                setWeekdayActivity(prefs.weekdayActivity || '');
                setWeekendActivity(prefs.weekendActivity || '');
                setSportOrHobby(prefs.sportOrHobby || '');
                setGeneralNotes(prefs.generalNotes || '');
            }
        } catch (error) {
            // First time — no preferences yet, use defaults
        } finally {
            setLoading(false);
        }
    };

    const validateTime = (value: string): boolean => {
        if (!value) return true;
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
    };

    const handleSave = async () => {
        // Validate time formats
        const times = { breakfastTime, lunchTime, dinnerTime, snackTime };
        for (const [field, value] of Object.entries(times)) {
            if (value && !validateTime(value)) {
                Alert.alert('Invalid Time', `${field.replace('Time', '')} time must be in HH:MM format (e.g., 08:00).`);
                return;
            }
        }

        setSaving(true);
        try {
            await preferencesApi.update({
                breakfastTime: breakfastTime || undefined,
                lunchTime: lunchTime || undefined,
                dinnerTime: dinnerTime || undefined,
                snackTime: snackTime || undefined,
                canCook,
                kitchenAvailable,
                hasDietaryCook,
                weekdayActivity: weekdayActivity || undefined,
                weekendActivity: weekendActivity || undefined,
                sportOrHobby: sportOrHobby || undefined,
                generalNotes: generalNotes || undefined,
            });
            toast.showToast({ title: 'Saved', message: 'Your preferences have been updated.', variant: 'success' });
        } catch (error) {
            Alert.alert('Error', 'Failed to save preferences. Please try again.');
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
                <Text style={styles.headerTitle}>My Preferences</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Meal Timings */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Clock size={20} color={Colors.primaryDark} />
                        <Text style={styles.sectionTitle}>Meal Timings</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>When do you usually eat? (HH:MM format)</Text>

                    <View style={styles.timeRow}>
                        <View style={styles.timeField}>
                            <Text style={styles.label}>Breakfast</Text>
                            <TextInput
                                style={styles.timeInput}
                                value={breakfastTime}
                                onChangeText={setBreakfastTime}
                                placeholder="08:00"
                                placeholderTextColor={Colors.textMuted}
                                keyboardType="numbers-and-punctuation"
                                maxLength={5}
                            />
                        </View>
                        <View style={styles.timeField}>
                            <Text style={styles.label}>Lunch</Text>
                            <TextInput
                                style={styles.timeInput}
                                value={lunchTime}
                                onChangeText={setLunchTime}
                                placeholder="13:00"
                                placeholderTextColor={Colors.textMuted}
                                keyboardType="numbers-and-punctuation"
                                maxLength={5}
                            />
                        </View>
                    </View>
                    <View style={styles.timeRow}>
                        <View style={styles.timeField}>
                            <Text style={styles.label}>Dinner</Text>
                            <TextInput
                                style={styles.timeInput}
                                value={dinnerTime}
                                onChangeText={setDinnerTime}
                                placeholder="19:30"
                                placeholderTextColor={Colors.textMuted}
                                keyboardType="numbers-and-punctuation"
                                maxLength={5}
                            />
                        </View>
                        <View style={styles.timeField}>
                            <Text style={styles.label}>Snack</Text>
                            <TextInput
                                style={styles.timeInput}
                                value={snackTime}
                                onChangeText={setSnackTime}
                                placeholder="16:00"
                                placeholderTextColor={Colors.textMuted}
                                keyboardType="numbers-and-punctuation"
                                maxLength={5}
                            />
                        </View>
                    </View>
                </View>

                {/* Kitchen & Cooking */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <ChefHat size={20} color={Colors.primaryDark} />
                        <Text style={styles.sectionTitle}>Kitchen & Cooking</Text>
                    </View>

                    <View style={styles.switchRow}>
                        <View style={styles.switchLabel}>
                            <Text style={styles.switchTitle}>Can you cook?</Text>
                            <Text style={styles.switchSubtitle}>Do you prepare your own meals?</Text>
                        </View>
                        <Switch
                            value={canCook}
                            onValueChange={setCanCook}
                            trackColor={{ false: Colors.border, true: Colors.primary }}
                            thumbColor={Colors.surface}
                        />
                    </View>

                    <View style={styles.switchRow}>
                        <View style={styles.switchLabel}>
                            <Text style={styles.switchTitle}>Kitchen available?</Text>
                            <Text style={styles.switchSubtitle}>Access to a kitchen for cooking</Text>
                        </View>
                        <Switch
                            value={kitchenAvailable}
                            onValueChange={setKitchenAvailable}
                            trackColor={{ false: Colors.border, true: Colors.primary }}
                            thumbColor={Colors.surface}
                        />
                    </View>

                    <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
                        <View style={styles.switchLabel}>
                            <Text style={styles.switchTitle}>Have a dietary cook?</Text>
                            <Text style={styles.switchSubtitle}>Someone who cooks diet-specific meals</Text>
                        </View>
                        <Switch
                            value={hasDietaryCook}
                            onValueChange={setHasDietaryCook}
                            trackColor={{ false: Colors.border, true: Colors.primary }}
                            thumbColor={Colors.surface}
                        />
                    </View>
                </View>

                {/* Lifestyle */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Activity size={20} color={Colors.primaryDark} />
                        <Text style={styles.sectionTitle}>Lifestyle</Text>
                    </View>

                    <Text style={styles.label}>Weekday Activity Level</Text>
                    <View style={styles.chipContainer}>
                        {ACTIVITY_LEVELS.map((level) => (
                            <TouchableOpacity
                                key={level}
                                style={[styles.chip, weekdayActivity === level && styles.chipSelected]}
                                onPress={() => setWeekdayActivity(weekdayActivity === level ? '' : level)}
                            >
                                <Text style={[styles.chipText, weekdayActivity === level && styles.chipTextSelected]}>
                                    {level}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.label}>Weekend Activity Level</Text>
                    <View style={styles.chipContainer}>
                        {ACTIVITY_LEVELS.map((level) => (
                            <TouchableOpacity
                                key={level}
                                style={[styles.chip, weekendActivity === level && styles.chipSelected]}
                                onPress={() => setWeekendActivity(weekendActivity === level ? '' : level)}
                            >
                                <Text style={[styles.chipText, weekendActivity === level && styles.chipTextSelected]}>
                                    {level}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.label}>Sport or Hobby</Text>
                    <TextInput
                        style={styles.input}
                        value={sportOrHobby}
                        onChangeText={setSportOrHobby}
                        placeholder="e.g., Swimming, Yoga, Cricket"
                        placeholderTextColor={Colors.textMuted}
                    />

                    <Text style={[styles.label, { marginTop: Spacing.lg }]}>General Notes</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={generalNotes}
                        onChangeText={setGeneralNotes}
                        placeholder="Any other preferences or notes for your dietitian..."
                        placeholderTextColor={Colors.textMuted}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
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
                        <Text style={styles.saveButtonText}>Save Preferences</Text>
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
        marginBottom: Spacing.sm,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
    },
    sectionSubtitle: {
        fontSize: FontSizes.sm,
        color: Colors.textMuted,
        marginBottom: Spacing.lg,
    },
    label: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.medium,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    timeRow: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginBottom: Spacing.md,
    },
    timeField: {
        flex: 1,
    },
    timeInput: {
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: FontSizes.lg,
        backgroundColor: Colors.background,
        color: Colors.text,
        textAlign: 'center',
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight,
    },
    switchLabel: {
        flex: 1,
        marginRight: Spacing.md,
    },
    switchTitle: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.medium,
        color: Colors.text,
    },
    switchSubtitle: {
        fontSize: FontSizes.sm,
        color: Colors.textMuted,
        marginTop: 2,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    chip: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: 10,
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.borderLight,
    },
    chipSelected: {
        backgroundColor: Colors.surfaceSecondary,
        borderColor: Colors.primaryDark,
    },
    chipText: {
        fontSize: FontSizes.sm,
        color: Colors.textMuted,
        fontWeight: FontWeights.medium,
    },
    chipTextSelected: {
        color: Colors.primaryDark,
        fontWeight: FontWeights.semibold,
    },
    input: {
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        backgroundColor: Colors.background,
        color: Colors.text,
    },
    textArea: {
        minHeight: 100,
    },
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
