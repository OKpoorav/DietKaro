import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useClientStats } from '../../../hooks/useMeals';
import { useWeightLogs, useCreateWeightLog } from '../../../hooks/useWeight';
import { ArrowLeft, PencilLine } from 'lucide-react-native';

// Figma Design Colors
const colors = {
    background: '#f8fcf9',
    primary: '#13ec5b',
    text: '#0d1b12',
    textSecondary: '#4c9a66',
    border: '#cfe7d7',
    surface: '#e7f3eb',
    error: '#e72a08',
};

export default function ProgressScreen() {
    const router = useRouter();
    const { data: stats, refetch: refetchStats } = useClientStats();
    const { data: weightLogs, isLoading: loadingWeights, refetch: refetchWeight } = useWeightLogs(10);
    const createWeightMutation = useCreateWeightLog();

    const [showWeightModal, setShowWeightModal] = useState(false);
    const [weightInput, setWeightInput] = useState('');

    // Parse weightKg - Prisma Decimal comes as string from API
    const latestLog = weightLogs?.[0];
    const currentWeight = latestLog
        ? (typeof latestLog.weightKg === 'string' ? parseFloat(latestLog.weightKg) : latestLog.weightKg)
        : stats?.latestWeight;
    const targetWeight = stats?.targetWeight || 65;
    const progressPercent = currentWeight && targetWeight
        ? Math.min(100, Math.max(0, ((80 - currentWeight) / (80 - targetWeight)) * 100))
        : 0;

    const handleLogWeight = async () => {
        const weight = parseFloat(weightInput);
        if (isNaN(weight) || weight < 20 || weight > 300) {
            Alert.alert('Invalid Weight', 'Please enter a valid weight between 20-300 kg');
            return;
        }

        try {
            await createWeightMutation.mutateAsync({
                weightKg: weight,
                logDate: new Date().toISOString().split('T')[0],
            });
            setWeightInput('');
            setShowWeightModal(false);
            Alert.alert('Success', 'Weight logged successfully!');
        } catch (error) {
            Alert.alert('Error', 'Failed to log weight. Please try again.');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Weight Tracking</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Current Weight Input */}
                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Current Weight</Text>
                    <TouchableOpacity
                        style={styles.weightInputBox}
                        onPress={() => setShowWeightModal(true)}
                    >
                        <Text style={styles.weightInputText}>
                            {currentWeight ? `${currentWeight} kg` : 'Tap to enter'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Weight Progress Chart */}
                <View style={styles.chartSection}>
                    <Text style={styles.sectionLabel}>Weight Progress</Text>
                    <Text style={styles.currentWeightLarge}>{currentWeight || '--'} kg</Text>
                    <Text style={styles.chartPeriod}>Last 8 Weeks</Text>

                    {/* Simple chart placeholder - would need react-native-svg for real chart */}
                    <View style={styles.chartPlaceholder}>
                        <View style={styles.chartLine} />
                    </View>

                    <View style={styles.weekLabels}>
                        {['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7'].map((week, i) => (
                            <Text key={i} style={styles.weekLabel}>{week}</Text>
                        ))}
                    </View>
                </View>

                {/* Goal Progress */}
                <View style={styles.goalSection}>
                    <Text style={styles.goalLabel}>Goal: {targetWeight} kg</Text>
                    <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
                    </View>
                    <Text style={styles.toGoText}>
                        {currentWeight && targetWeight
                            ? `${Math.abs(currentWeight - targetWeight).toFixed(1)} kg to go`
                            : 'Set your goal weight'}
                    </Text>
                </View>
            </ScrollView>

            {/* Update Weight Button */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={styles.updateButton}
                    onPress={() => setShowWeightModal(true)}
                >
                    <PencilLine size={24} color={colors.text} />
                    <Text style={styles.updateButtonText}>Update Weight</Text>
                </TouchableOpacity>
            </View>

            {/* Weight Input Modal */}
            <Modal
                visible={showWeightModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowWeightModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Log Your Weight</Text>
                        <View style={styles.modalInputRow}>
                            <TextInput
                                style={styles.modalInput}
                                value={weightInput}
                                onChangeText={setWeightInput}
                                placeholder="0.0"
                                placeholderTextColor={colors.textSecondary}
                                keyboardType="decimal-pad"
                                autoFocus
                            />
                            <Text style={styles.modalUnit}>kg</Text>
                        </View>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => setShowWeightModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalSubmitButton}
                                onPress={handleLogWeight}
                                disabled={createWeightMutation.isPending}
                            >
                                {createWeightMutation.isPending ? (
                                    <ActivityIndicator color={colors.text} />
                                ) : (
                                    <Text style={styles.modalSubmitText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    backButton: {
        width: 48,
        height: 48,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: -0.015 * 18,
    },
    headerSpacer: {
        width: 48,
    },
    scrollView: {
        flex: 1,
    },
    inputContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
        marginBottom: 8,
    },
    weightInputBox: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        height: 56,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    weightInputText: {
        fontSize: 16,
        color: colors.textSecondary,
    },
    chartSection: {
        paddingHorizontal: 16,
        paddingVertical: 24,
    },
    sectionLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
    },
    currentWeightLarge: {
        fontSize: 32,
        fontWeight: '700',
        color: colors.text,
        marginTop: 8,
    },
    chartPeriod: {
        fontSize: 16,
        color: colors.textSecondary,
        marginBottom: 16,
    },
    chartPlaceholder: {
        height: 180,
        backgroundColor: colors.surface,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    chartLine: {
        width: '80%',
        height: 3,
        backgroundColor: colors.textSecondary,
        borderRadius: 2,
    },
    weekLabels: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    weekLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    goalSection: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    goalLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
        marginBottom: 8,
    },
    progressBarContainer: {
        height: 8,
        backgroundColor: colors.border,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 4,
    },
    toGoText: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 8,
    },
    buttonContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    updateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: 12,
    },
    updateButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 20,
        textAlign: 'center',
    },
    modalInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    modalInput: {
        flex: 1,
        fontSize: 32,
        fontWeight: '700',
        color: colors.text,
        paddingVertical: 16,
    },
    modalUnit: {
        fontSize: 18,
        color: colors.textSecondary,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalCancelButton: {
        flex: 1,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalCancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    modalSubmitButton: {
        flex: 1,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: colors.primary,
    },
    modalSubmitText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
});
