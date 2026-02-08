import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';
import { onboardingApi } from '../../services/api';

export default function BasicInfoScreen() {
    const router = useRouter();
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [targetWeight, setTargetWeight] = useState('');
    const [gender, setGender] = useState('male');
    const [activityLevel, setActivityLevel] = useState('SEDENTARY');
    const [saving, setSaving] = useState(false);

    const handleNext = async () => {
        if (!height || !weight) {
            Alert.alert('Required Fields', 'Please enter your height and current weight.');
            return;
        }

        setSaving(true);
        try {
            await onboardingApi.saveStep(1, {
                heightCm: parseFloat(height),
                currentWeightKg: parseFloat(weight),
                targetWeightKg: targetWeight ? parseFloat(targetWeight) : undefined,
                gender,
                activityLevel: activityLevel.toLowerCase(),
            });
            router.push('/(onboarding)/step2');
        } catch (error) {
            Alert.alert('Error', 'Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>Let's get to know you</Text>
            <Text style={styles.subtitle}>We need some basic information to calculate your nutritional needs.</Text>

            <View style={styles.formGroup}>
                <Text style={styles.label}>Height (cm)</Text>
                <TextInput
                    style={styles.input}
                    value={height}
                    onChangeText={setHeight}
                    keyboardType="numeric"
                    placeholder="e.g. 175"
                />
            </View>

            <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                    <Text style={styles.label}>Current Weight (kg)</Text>
                    <TextInput
                        style={styles.input}
                        value={weight}
                        onChangeText={setWeight}
                        keyboardType="numeric"
                        placeholder="e.g. 70"
                    />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Target Weight (kg)</Text>
                    <TextInput
                        style={styles.input}
                        value={targetWeight}
                        onChangeText={setTargetWeight}
                        keyboardType="numeric"
                        placeholder="e.g. 65"
                    />
                </View>
            </View>

            <View style={styles.formGroup}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={gender}
                        onValueChange={(itemValue) => setGender(itemValue)}
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
                        onValueChange={(itemValue) => setActivityLevel(itemValue)}
                    >
                        <Picker.Item label="Sedentary (Little/no exercise)" value="SEDENTARY" />
                        <Picker.Item label="Lightly Active (1-3 days/week)" value="LIGHTLY_ACTIVE" />
                        <Picker.Item label="Moderately Active (3-5 days/week)" value="MODERATELY_ACTIVE" />
                        <Picker.Item label="Very Active (6-7 days/week)" value="VERY_ACTIVE" />
                        <Picker.Item label="Extremely Active (Physical job)" value="EXTREMELY_ACTIVE" />
                    </Picker>
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
    formGroup: {
        marginBottom: Spacing.xl,
    },
    row: {
        flexDirection: 'row',
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
    pickerContainer: {
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.background,
        overflow: 'hidden',
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
    }
});
