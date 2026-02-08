import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { ArrowLeft, Ruler, User } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../../constants/theme';
import { onboardingApi } from '../../../services/api';
import { useToast } from '../../../components/Toast';

export default function BodyProfileScreen() {
    const router = useRouter();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Basic info (step 1)
    const [height, setHeight] = useState('');
    const [currentWeight, setCurrentWeight] = useState('');
    const [targetWeight, setTargetWeight] = useState('');
    const [gender, setGender] = useState('male');
    const [activityLevel, setActivityLevel] = useState('sedentary');

    // Body measurements (step 6)
    const [chest, setChest] = useState('');
    const [waist, setWaist] = useState('');
    const [hips, setHips] = useState('');
    const [thighs, setThighs] = useState('');
    const [arms, setArms] = useState('');
    const [bodyFat, setBodyFat] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const response = await onboardingApi.getStatus();
            const { stepsData } = response.data.data;

            // Step 1
            if (stepsData.step1) {
                setHeight(stepsData.step1.heightCm ? String(stepsData.step1.heightCm) : '');
                setCurrentWeight(stepsData.step1.currentWeightKg ? String(stepsData.step1.currentWeightKg) : '');
                setTargetWeight(stepsData.step1.targetWeightKg ? String(stepsData.step1.targetWeightKg) : '');
                setGender(stepsData.step1.gender || 'male');
                setActivityLevel(stepsData.step1.activityLevel || 'sedentary');
            }

            // Step 6
            if (stepsData.step6) {
                setChest(stepsData.step6.chestCm ? String(stepsData.step6.chestCm) : '');
                setWaist(stepsData.step6.waistCm ? String(stepsData.step6.waistCm) : '');
                setHips(stepsData.step6.hipsCm ? String(stepsData.step6.hipsCm) : '');
                setThighs(stepsData.step6.thighsCm ? String(stepsData.step6.thighsCm) : '');
                setArms(stepsData.step6.armsCm ? String(stepsData.step6.armsCm) : '');
                setBodyFat(stepsData.step6.bodyFatPercentage ? String(stepsData.step6.bodyFatPercentage) : '');
            }
        } catch (error) {
            // Defaults
        } finally {
            setLoading(false);
        }
    };

    const validateMeasurement = (value: string, label: string): boolean => {
        if (!value) return true;
        const num = parseFloat(value);
        if (isNaN(num) || num < 20 || num > 200) {
            Alert.alert('Invalid Value', `${label} must be between 20 and 200 cm.`);
            return false;
        }
        return true;
    };

    const handleSave = async () => {
        if (!height) {
            Alert.alert('Required', 'Please enter your height.');
            return;
        }

        // Validate measurements
        if (!validateMeasurement(chest, 'Chest')) return;
        if (!validateMeasurement(waist, 'Waist')) return;
        if (!validateMeasurement(hips, 'Hips')) return;
        if (!validateMeasurement(thighs, 'Thighs')) return;
        if (!validateMeasurement(arms, 'Arms')) return;
        if (bodyFat) {
            const bf = parseFloat(bodyFat);
            if (isNaN(bf) || bf < 3 || bf > 60) {
                Alert.alert('Invalid Value', 'Body fat % must be between 3 and 60.');
                return;
            }
        }

        setSaving(true);
        try {
            // Save basic info
            await onboardingApi.saveStep(1, {
                heightCm: parseFloat(height),
                currentWeightKg: currentWeight ? parseFloat(currentWeight) : undefined,
                targetWeightKg: targetWeight ? parseFloat(targetWeight) : undefined,
                gender,
                activityLevel,
            });

            // Save measurements only if any provided
            const hasMeasurements = chest || waist || hips || thighs || arms || bodyFat;
            if (hasMeasurements) {
                await onboardingApi.saveStep(6, {
                    chestCm: chest ? parseFloat(chest) : undefined,
                    waistCm: waist ? parseFloat(waist) : undefined,
                    hipsCm: hips ? parseFloat(hips) : undefined,
                    thighsCm: thighs ? parseFloat(thighs) : undefined,
                    armsCm: arms ? parseFloat(arms) : undefined,
                    bodyFatPercentage: bodyFat ? parseFloat(bodyFat) : undefined,
                });
            }

            toast.showToast({ title: 'Saved', message: 'Your body profile has been updated.', variant: 'success' });
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
                <Text style={styles.headerTitle}>Body Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

                {/* Basic Info */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <User size={20} color={Colors.primaryDark} />
                        <Text style={styles.sectionTitle}>Basic Info</Text>
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Height (cm)</Text>
                        <TextInput
                            style={styles.input}
                            value={height}
                            onChangeText={setHeight}
                            keyboardType="numeric"
                            placeholder="e.g. 175"
                            placeholderTextColor={Colors.textMuted}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                            <Text style={styles.label}>Current Weight (kg)</Text>
                            <TextInput
                                style={[styles.input, styles.readOnlyInput]}
                                value={currentWeight ? `${currentWeight}` : '--'}
                                editable={false}
                            />
                            <Text style={styles.helperText}>Update via weight log</Text>
                        </View>
                        <View style={[styles.formGroup, { flex: 1 }]}>
                            <Text style={styles.label}>Target Weight (kg)</Text>
                            <TextInput
                                style={styles.input}
                                value={targetWeight}
                                onChangeText={setTargetWeight}
                                keyboardType="numeric"
                                placeholder="e.g. 65"
                                placeholderTextColor={Colors.textMuted}
                            />
                        </View>
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Gender</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={gender}
                                onValueChange={setGender}
                            >
                                <Picker.Item label="Male" value="male" />
                                <Picker.Item label="Female" value="female" />
                                <Picker.Item label="Other" value="other" />
                            </Picker>
                        </View>
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Activity Level</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={activityLevel}
                                onValueChange={setActivityLevel}
                            >
                                <Picker.Item label="Sedentary (Little/no exercise)" value="sedentary" />
                                <Picker.Item label="Lightly Active (1-3 days/week)" value="lightly_active" />
                                <Picker.Item label="Moderately Active (3-5 days/week)" value="moderately_active" />
                                <Picker.Item label="Very Active (6-7 days/week)" value="very_active" />
                                <Picker.Item label="Extremely Active (Physical job)" value="extremely_active" />
                            </Picker>
                        </View>
                    </View>
                </View>

                {/* Body Measurements */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ruler size={20} color={Colors.primaryDark} />
                        <Text style={styles.sectionTitle}>Body Measurements</Text>
                    </View>
                    <Text style={styles.sectionSubtitle}>All measurements are optional (in cm)</Text>

                    <View style={styles.row}>
                        <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                            <Text style={styles.label}>Chest</Text>
                            <TextInput
                                style={styles.input}
                                value={chest}
                                onChangeText={setChest}
                                keyboardType="numeric"
                                placeholder="e.g. 95"
                                placeholderTextColor={Colors.textMuted}
                            />
                        </View>
                        <View style={[styles.formGroup, { flex: 1 }]}>
                            <Text style={styles.label}>Waist</Text>
                            <TextInput
                                style={styles.input}
                                value={waist}
                                onChangeText={setWaist}
                                keyboardType="numeric"
                                placeholder="e.g. 80"
                                placeholderTextColor={Colors.textMuted}
                            />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                            <Text style={styles.label}>Hips</Text>
                            <TextInput
                                style={styles.input}
                                value={hips}
                                onChangeText={setHips}
                                keyboardType="numeric"
                                placeholder="e.g. 95"
                                placeholderTextColor={Colors.textMuted}
                            />
                        </View>
                        <View style={[styles.formGroup, { flex: 1 }]}>
                            <Text style={styles.label}>Thighs</Text>
                            <TextInput
                                style={styles.input}
                                value={thighs}
                                onChangeText={setThighs}
                                keyboardType="numeric"
                                placeholder="e.g. 55"
                                placeholderTextColor={Colors.textMuted}
                            />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                            <Text style={styles.label}>Arms</Text>
                            <TextInput
                                style={styles.input}
                                value={arms}
                                onChangeText={setArms}
                                keyboardType="numeric"
                                placeholder="e.g. 32"
                                placeholderTextColor={Colors.textMuted}
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
                                placeholderTextColor={Colors.textMuted}
                            />
                        </View>
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
    formGroup: {
        marginBottom: Spacing.lg,
    },
    row: {
        flexDirection: 'row',
    },
    label: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.medium,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    input: {
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: FontSizes.lg,
        backgroundColor: Colors.background,
        color: Colors.text,
    },
    readOnlyInput: {
        backgroundColor: '#f3f4f6',
        color: Colors.textMuted,
    },
    helperText: {
        fontSize: FontSizes.xs,
        color: Colors.textMuted,
        marginTop: 4,
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.background,
        overflow: 'hidden',
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
