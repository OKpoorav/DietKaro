import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useClientStats } from '../../../hooks/useMeals';
import { useWeightLogs, useCreateWeightLog } from '../../../hooks/useWeight';
import { useToast } from '../../../components/Toast';
import { ArrowLeft, PencilLine } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, Shadows } from '../../../constants/theme';

export default function ProgressScreen() {
    const router = useRouter();
    const { data: stats, refetch: refetchStats } = useClientStats();
    const { data: weightLogs, isLoading: loadingWeights, refetch: refetchWeight } = useWeightLogs(10);
    const createWeightMutation = useCreateWeightLog();
    const { showToast } = useToast();

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
            showToast({ title: 'Invalid Weight', message: 'Please enter a valid weight between 20-300 kg', variant: 'warning' });
            return;
        }

        try {
            await createWeightMutation.mutateAsync({
                weightKg: weight,
                logDate: new Date().toISOString().split('T')[0],
            });
            setWeightInput('');
            setShowWeightModal(false);
            showToast({ title: 'Success', message: 'Weight logged successfully!', variant: 'success' });
        } catch (error) {
            showToast({ title: 'Error', message: 'Failed to log weight. Please try again.', variant: 'error' });
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.text} />
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
                    <PencilLine size={24} color={Colors.text} />
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
                                placeholderTextColor={Colors.textSecondary}
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
                                    <ActivityIndicator color={Colors.text} />
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
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    backButton: {
        width: 48,
        height: 48,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        letterSpacing: -0.015 * 18,
    },
    headerSpacer: {
        width: 48,
    },
    scrollView: {
        flex: 1,
    },
    inputContainer: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    inputLabel: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.medium,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    weightInputBox: {
        backgroundColor: Colors.surfaceSecondary,
        borderRadius: BorderRadius.md,
        height: 56,
        justifyContent: 'center',
        paddingHorizontal: Spacing.lg,
    },
    weightInputText: {
        fontSize: FontSizes.lg,
        color: Colors.textSecondary,
    },
    chartSection: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.xxl,
    },
    sectionLabel: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.medium,
        color: Colors.text,
    },
    currentWeightLarge: {
        fontSize: FontSizes.display,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        marginTop: Spacing.sm,
    },
    chartPeriod: {
        fontSize: FontSizes.lg,
        color: Colors.textSecondary,
        marginBottom: Spacing.lg,
    },
    chartPlaceholder: {
        height: 180,
        backgroundColor: Colors.surfaceSecondary,
        borderRadius: BorderRadius.sm,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    chartLine: {
        width: '80%',
        height: 3,
        backgroundColor: Colors.textSecondary,
        borderRadius: 2,
    },
    weekLabels: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    weekLabel: {
        fontSize: FontSizes.sm,
        fontWeight: FontWeights.bold,
        color: Colors.textSecondary,
    },
    goalSection: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    goalLabel: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.medium,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    progressBarContainer: {
        height: 8,
        backgroundColor: Colors.border,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 4,
    },
    toGoText: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        marginTop: Spacing.sm,
    },
    buttonContainer: {
        padding: Spacing.xl,
        paddingBottom: 40,
    },
    updateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.lg,
        backgroundColor: Colors.primary,
        height: 56,
        borderRadius: BorderRadius.md,
    },
    updateButtonText: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.bold,
        color: Colors.text,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.surface,
        borderTopLeftRadius: Spacing.xxl,
        borderTopRightRadius: Spacing.xxl,
        padding: Spacing.xxl,
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        marginBottom: Spacing.xl,
        textAlign: 'center',
    },
    modalInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.xxl,
    },
    modalInput: {
        flex: 1,
        fontSize: FontSizes.display,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        paddingVertical: Spacing.lg,
    },
    modalUnit: {
        fontSize: FontSizes.xl,
        color: Colors.textSecondary,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    modalCancelButton: {
        flex: 1,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    modalCancelText: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
    },
    modalSubmitButton: {
        flex: 1,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primary,
    },
    modalSubmitText: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.bold,
        color: Colors.text,
    },
});
