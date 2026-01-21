import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ThumbsDown, Plus } from 'lucide-react-native';

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
                        <Plus size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {dislikes.length > 0 && (
                <View style={styles.summary}>
                    <View style={styles.iconBox}>
                        <ThumbsDown size={20} color="#666" />
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
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#eee',
    },
    selectedChip: {
        backgroundColor: '#e5e7eb',
        borderColor: '#9ca3af',
    },
    chipText: {
        color: '#666',
        fontWeight: '500',
    },
    selectedChipText: {
        color: '#111',
        fontWeight: '600',
    },
    inputContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        backgroundColor: '#f9f9f9',
    },
    addButton: {
        width: 50,
        height: 50,
        borderRadius: 12,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    summary: {
        flexDirection: 'row',
        backgroundColor: '#f9fafb',
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
        marginBottom: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    iconBox: {
        marginRight: 12,
    },
    summaryText: {
        flex: 1,
        color: '#4b5563',
        fontSize: 14,
        lineHeight: 20,
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
