import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Calendar, Apple } from 'lucide-react-native';

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
                                    <Apple size={20} color={selectedPreset === preset.id ? '#17cf54' : '#666'} />
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
                                            <Calendar size={12} color="#17cf54" />
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
                        trackColor={{ false: '#eee', true: '#17cf54' }}
                        thumbColor={'#fff'}
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
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
        color: '#333',
    },
    presets: {
        gap: 12,
    },
    card: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eee',
        backgroundColor: '#fff',
    },
    selectedCard: {
        borderColor: '#17cf54',
        backgroundColor: '#f0fdf4',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    selectedIconBox: {
        backgroundColor: '#fff',
    },
    cardText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 2,
    },
    selectedText: {
        color: '#17cf54',
    },
    cardDesc: {
        fontSize: 12,
        color: '#888',
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#ddd',
    },
    selectedRadio: {
        borderColor: '#17cf54',
        backgroundColor: '#17cf54',
    },
    tagContainer: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#e0f2e0',
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#fff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    tagText: {
        fontSize: 12,
        color: '#17cf54',
        fontWeight: '500',
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
    },
    toggleLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    hint: {
        marginTop: 8,
        fontSize: 12,
        color: '#888',
        fontStyle: 'italic',
    },
    button: {
        backgroundColor: '#17cf54',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    }
});
