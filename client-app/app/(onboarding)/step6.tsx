import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ruler } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';
import { onboardingApi } from '../../services/api';

export default function BodyMeasurementsScreen() {
    const router = useRouter();
    const [chest, setChest] = useState('');
    const [waist, setWaist] = useState('');
    const [hips, setHips] = useState('');
    const [thighs, setThighs] = useState('');
    const [arms, setArms] = useState('');
    const [bodyFat, setBodyFat] = useState('');
    const [saving, setSaving] = useState(false);

    const validateMeasurement = (value: string, label: string): boolean => {
        if (!value) return true; // all optional
        const num = parseFloat(value);
        if (isNaN(num) || num < 20 || num > 200) {
            Alert.alert('Invalid Value', `${label} must be between 20 and 200 cm.`);
            return false;
        }
        return true;
    };

    const validateBodyFat = (value: string): boolean => {
        if (!value) return true;
        const num = parseFloat(value);
        if (isNaN(num) || num < 3 || num > 60) {
            Alert.alert('Invalid Value', 'Body fat % must be between 3 and 60.');
            return false;
        }
        return true;
    };

    const handleSave = async () => {
        if (!validateMeasurement(chest, 'Chest')) return;
        if (!validateMeasurement(waist, 'Waist')) return;
        if (!validateMeasurement(hips, 'Hips')) return;
        if (!validateMeasurement(thighs, 'Thighs')) return;
        if (!validateMeasurement(arms, 'Arms')) return;
        if (!validateBodyFat(bodyFat)) return;

        setSaving(true);
        try {
            await onboardingApi.saveStep(6, {
                chestCm: chest ? parseFloat(chest) : undefined,
                waistCm: waist ? parseFloat(waist) : undefined,
                hipsCm: hips ? parseFloat(hips) : undefined,
                thighsCm: thighs ? parseFloat(thighs) : undefined,
                armsCm: arms ? parseFloat(arms) : undefined,
                bodyFatPercentage: bodyFat ? parseFloat(bodyFat) : undefined,
            });
            router.replace('/(onboarding)/complete');
        } catch (error) {
            Alert.alert('Error', 'Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleSkip = () => {
        router.replace('/(onboarding)/complete');
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.headerIcon}>
                <Ruler size={32} color={Colors.primaryDark} />
            </View>
            <Text style={styles.title}>Body Measurements</Text>
            <Text style={styles.subtitle}>
                Help your dietitian track your progress more accurately. All fields are optional.
            </Text>

            <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                    <Text style={styles.label}>Chest (cm)</Text>
                    <TextInput
                        style={styles.input}
                        value={chest}
                        onChangeText={setChest}
                        keyboardType="numeric"
                        placeholder="e.g. 95"
                    />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Waist (cm)</Text>
                    <TextInput
                        style={styles.input}
                        value={waist}
                        onChangeText={setWaist}
                        keyboardType="numeric"
                        placeholder="e.g. 80"
                    />
                </View>
            </View>

            <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                    <Text style={styles.label}>Hips (cm)</Text>
                    <TextInput
                        style={styles.input}
                        value={hips}
                        onChangeText={setHips}
                        keyboardType="numeric"
                        placeholder="e.g. 95"
                    />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Thighs (cm)</Text>
                    <TextInput
                        style={styles.input}
                        value={thighs}
                        onChangeText={setThighs}
                        keyboardType="numeric"
                        placeholder="e.g. 55"
                    />
                </View>
            </View>

            <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                    <Text style={styles.label}>Arms (cm)</Text>
                    <TextInput
                        style={styles.input}
                        value={arms}
                        onChangeText={setArms}
                        keyboardType="numeric"
                        placeholder="e.g. 32"
                    />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Body Fat %</Text>
                    <TextInput
                        style={styles.input}
                        value={bodyFat}
                        onChangeText={setBodyFat}
                        keyboardType="decimal-pad"
                        placeholder="e.g. 22"
                    />
                </View>
            </View>

            <TouchableOpacity
                style={[styles.button, saving && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={saving}
            >
                {saving ? (
                    <ActivityIndicator color={Colors.surface} />
                ) : (
                    <Text style={styles.buttonText}>Save & Continue</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                disabled={saving}
            >
                <Text style={styles.skipButtonText}>Skip for now</Text>
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
    headerIcon: {
        marginBottom: Spacing.lg,
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
    row: {
        flexDirection: 'row',
    },
    formGroup: {
        marginBottom: Spacing.xl,
    },
    label: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    input: {
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        fontSize: FontSizes.lg,
        backgroundColor: Colors.background,
    },
    button: {
        backgroundColor: Colors.primaryDark,
        padding: Spacing.xl,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        marginTop: Spacing.xl,
        shadowColor: Colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: Colors.surface,
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
    },
    skipButton: {
        padding: Spacing.xl,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        marginTop: Spacing.md,
    },
    skipButtonText: {
        color: Colors.textMuted,
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.medium,
    },
});
