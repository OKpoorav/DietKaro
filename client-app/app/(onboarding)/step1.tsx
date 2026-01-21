import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';

export default function BasicInfoScreen() {
    const router = useRouter();
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [targetWeight, setTargetWeight] = useState('');
    const [gender, setGender] = useState('male');
    const [activityLevel, setActivityLevel] = useState('SEDENTARY');

    const handleNext = async () => {
        // TODO: Validate and save to API
        // await api.post('/clients/${clientId}/onboarding/step/1', { ... });

        router.push('/(onboarding)/step2');
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
    formGroup: {
        marginBottom: 20,
    },
    row: {
        flexDirection: 'row',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        backgroundColor: '#f9f9f9',
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        backgroundColor: '#f9f9f9',
        overflow: 'hidden',
    },
    button: {
        backgroundColor: '#17cf54',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
        shadowColor: '#17cf54',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    }
});
