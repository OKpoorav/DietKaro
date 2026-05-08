import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Ruler } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';
import { onboardingApi } from '../../services/api';

export default function BodyMeasurementsScreen() {
    const router = useRouter();
    const [upperArm, setUpperArm] = useState('');
    const [chest, setChest] = useState('');
    const [waist, setWaist] = useState('');
    const [stomach, setStomach] = useState('');
    const [bellyAboveNavel, setBellyAboveNavel] = useState('');
    const [bellyBelowNavel, setBellyBelowNavel] = useState('');
    const [hips, setHips] = useState('');
    const [upperThigh, setUpperThigh] = useState('');
    const [calf, setCalf] = useState('');
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
        if (!validateMeasurement(upperArm, 'Upper Arm')) return;
        if (!validateMeasurement(chest, 'Chest')) return;
        if (!validateMeasurement(waist, 'Waist')) return;
        if (!validateMeasurement(stomach, 'Stomach')) return;
        if (!validateMeasurement(bellyAboveNavel, 'Belly (above navel)')) return;
        if (!validateMeasurement(bellyBelowNavel, 'Belly (below navel)')) return;
        if (!validateMeasurement(hips, 'Hips')) return;
        if (!validateMeasurement(upperThigh, 'Upper Thigh')) return;
        if (!validateMeasurement(calf, 'Calf')) return;
        if (!validateBodyFat(bodyFat)) return;

        setSaving(true);
        try {
            await onboardingApi.saveStep(6, {
                armsCm: upperArm ? parseFloat(upperArm) : undefined,
                chestCm: chest ? parseFloat(chest) : undefined,
                waistCm: waist ? parseFloat(waist) : undefined,
                stomachCm: stomach ? parseFloat(stomach) : undefined,
                bellyAboveNavelCm: bellyAboveNavel ? parseFloat(bellyAboveNavel) : undefined,
                bellyBelowNavelCm: bellyBelowNavel ? parseFloat(bellyBelowNavel) : undefined,
                hipsCm: hips ? parseFloat(hips) : undefined,
                thighsCm: upperThigh ? parseFloat(upperThigh) : undefined,
                calfCm: calf ? parseFloat(calf) : undefined,
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
                    <Text style={styles.label}>Upper Arm (cm)</Text>
                    <TextInput
                        style={styles.input}
                        value={upperArm}
                        onChangeText={setUpperArm}
                        keyboardType="numeric"
                        placeholder="e.g. 32"
                    />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Chest (cm)</Text>
                    <TextInput
                        style={styles.input}
                        value={chest}
                        onChangeText={setChest}
                        keyboardType="numeric"
                        placeholder="e.g. 95"
                    />
                </View>
            </View>

            <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                    <Text style={styles.label}>Waist (cm)</Text>
                    <TextInput
                        style={styles.input}
                        value={waist}
                        onChangeText={setWaist}
                        keyboardType="numeric"
                        placeholder="e.g. 80"
                    />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Stomach (cm)</Text>
                    <TextInput
                        style={styles.input}
                        value={stomach}
                        onChangeText={setStomach}
                        keyboardType="numeric"
                        placeholder="around navel"
                    />
                </View>
            </View>

            <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                    <Text style={styles.label}>Belly +2" above navel</Text>
                    <TextInput
                        style={styles.input}
                        value={bellyAboveNavel}
                        onChangeText={setBellyAboveNavel}
                        keyboardType="numeric"
                        placeholder="e.g. 88"
                    />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Belly +2" below navel</Text>
                    <TextInput
                        style={styles.input}
                        value={bellyBelowNavel}
                        onChangeText={setBellyBelowNavel}
                        keyboardType="numeric"
                        placeholder="e.g. 92"
                    />
                </View>
            </View>

            <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                    <Text style={styles.label}>Hip (cm)</Text>
                    <TextInput
                        style={styles.input}
                        value={hips}
                        onChangeText={setHips}
                        keyboardType="numeric"
                        placeholder="e.g. 95"
                    />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Upper Thigh (cm)</Text>
                    <TextInput
                        style={styles.input}
                        value={upperThigh}
                        onChangeText={setUpperThigh}
                        keyboardType="numeric"
                        placeholder="e.g. 55"
                    />
                </View>
            </View>

            <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                    <Text style={styles.label}>Calf (cm)</Text>
                    <TextInput
                        style={styles.input}
                        value={calf}
                        onChangeText={setCalf}
                        keyboardType="numeric"
                        placeholder="e.g. 36"
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
