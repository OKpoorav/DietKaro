import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWeightLogs, useCreateWeightLog } from '../../../hooks/useWeight';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../components/Toast';
import { Plus, TrendingDown, TrendingUp, Minus, Target, Award } from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, Shadows } from '../../../constants/theme';

const screenWidth = Dimensions.get('window').width;

export default function WeightScreen() {
    const { data: weightLogs, isLoading } = useWeightLogs(10);
    const { client } = useAuth();
    const createMutation = useCreateWeightLog();
    const { showToast } = useToast();
    const [weight, setWeight] = useState('');
    const [notes, setNotes] = useState('');
    const [showForm, setShowForm] = useState(false);

    const handleLogWeight = async () => {
        const weightNum = parseFloat(weight);
        if (isNaN(weightNum) || weightNum < 20 || weightNum > 300) {
            showToast({ title: 'Invalid Weight', message: 'Please enter a valid weight between 20-300 kg', variant: 'warning' });
            return;
        }

        try {
            await createMutation.mutateAsync({
                weightKg: weightNum,
                logDate: new Date().toISOString().split('T')[0],
                notes: notes || undefined,
            });
            setWeight('');
            setNotes('');
            setShowForm(false);
            showToast({ title: 'Success', message: 'Weight logged successfully!', variant: 'success' });
        } catch (error) {
            showToast({ title: 'Error', message: 'Failed to log weight. Please try again.', variant: 'error' });
        }
    };

    const latestWeight = weightLogs?.[0]?.weightKg;
    const previousWeight = weightLogs?.[1]?.weightKg;
    const change = latestWeight && previousWeight ? latestWeight - previousWeight : null;
    const targetWeight = client?.targetWeightKg;

    // Calculate progress metrics
    const startWeight = weightLogs?.length ? weightLogs[weightLogs.length - 1]?.weightKg : null;
    const weightLost = startWeight && latestWeight ? startWeight - latestWeight : 0;
    const remainingToGoal = targetWeight && latestWeight ? latestWeight - targetWeight : null;
    const progressPercent = startWeight && targetWeight && latestWeight
        ? Math.min(100, Math.max(0, ((startWeight - latestWeight) / (startWeight - targetWeight)) * 100))
        : 0;

    // Prepare chart data (reverse to show oldest first)
    const chartData = weightLogs?.slice(0, 7).reverse() || [];
    const hasChartData = chartData.length >= 2;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Weight Tracking</Text>
                <Text style={styles.subtitle}>Monitor your progress over time</Text>

                {/* Current Weight Card */}
                <View style={styles.currentCard}>
                    <Text style={styles.currentLabel}>Current Weight</Text>
                    <View style={styles.currentValueRow}>
                        <Text style={styles.currentValue}>{latestWeight || '--'}</Text>
                        <Text style={styles.currentUnit}>kg</Text>
                        {change !== null && (
                            <View style={[styles.changeBadge, change < 0 ? styles.changeDown : change > 0 ? styles.changeUp : styles.changeNeutral]}>
                                {change < 0 ? <TrendingDown size={14} color="#065f46" /> : change > 0 ? <TrendingUp size={14} color="#991b1b" /> : <Minus size={14} color={Colors.textMuted} />}
                                <Text style={[styles.changeText, change < 0 ? styles.changeTextDown : change > 0 ? styles.changeTextUp : styles.changeTextNeutral]}>
                                    {change > 0 ? '+' : ''}{change.toFixed(1)} kg
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Goal Progress Card */}
                {targetWeight && (
                    <View style={styles.goalCard}>
                        <View style={styles.goalHeader}>
                            <Target size={20} color={Colors.primaryDark} />
                            <Text style={styles.goalTitle}>Goal Progress</Text>
                        </View>

                        <View style={styles.goalStats}>
                            <View style={styles.goalStat}>
                                <Text style={styles.goalStatValue}>{targetWeight}</Text>
                                <Text style={styles.goalStatLabel}>Target (kg)</Text>
                            </View>
                            <View style={styles.goalStatDivider} />
                            <View style={styles.goalStat}>
                                <Text style={[styles.goalStatValue, weightLost > 0 && styles.goalStatPositive]}>
                                    {weightLost > 0 ? '-' : ''}{Math.abs(weightLost).toFixed(1)}
                                </Text>
                                <Text style={styles.goalStatLabel}>Lost (kg)</Text>
                            </View>
                            <View style={styles.goalStatDivider} />
                            <View style={styles.goalStat}>
                                <Text style={styles.goalStatValue}>
                                    {remainingToGoal !== null ? remainingToGoal.toFixed(1) : '--'}
                                </Text>
                                <Text style={styles.goalStatLabel}>To Go (kg)</Text>
                            </View>
                        </View>

                        {/* Progress Bar */}
                        <View style={styles.progressBarContainer}>
                            <View style={styles.progressBarBackground}>
                                <View style={[styles.progressBarFill, { width: `${Math.min(100, progressPercent)}%` }]} />
                            </View>
                            <Text style={styles.progressText}>{progressPercent.toFixed(0)}% to goal</Text>
                        </View>
                    </View>
                )}

                {/* Weight Trend Chart */}
                {hasChartData && (
                    <View style={styles.chartCard}>
                        <Text style={styles.chartTitle}>7-Day Trend</Text>
                        <LineChart
                            data={{
                                labels: chartData.map(log => {
                                    const date = new Date(log.logDate);
                                    return `${date.getDate()}/${date.getMonth() + 1}`;
                                }),
                                datasets: [
                                    {
                                        data: chartData.map(log => log.weightKg),
                                        color: (opacity = 1) => `rgba(23, 207, 84, ${opacity})`,
                                        strokeWidth: 2,
                                    },
                                    ...(targetWeight ? [{
                                        data: chartData.map(() => targetWeight),
                                        color: (opacity = 1) => `rgba(239, 68, 68, ${opacity * 0.5})`,
                                        strokeWidth: 1,
                                        withDots: false,
                                    }] : []),
                                ],
                            }}
                            width={screenWidth - 56}
                            height={180}
                            chartConfig={{
                                backgroundColor: '#ffffff',
                                backgroundGradientFrom: '#ffffff',
                                backgroundGradientTo: '#ffffff',
                                decimalPlaces: 1,
                                color: (opacity = 1) => `rgba(17, 24, 39, ${opacity})`,
                                labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                                style: { borderRadius: 16 },
                                propsForDots: {
                                    r: '5',
                                    strokeWidth: '2',
                                    stroke: '#17cf54',
                                },
                                propsForBackgroundLines: {
                                    strokeDasharray: '',
                                    stroke: '#e5e7eb',
                                },
                            }}
                            bezier
                            style={styles.chart}
                        />
                        {targetWeight && (
                            <View style={styles.chartLegend}>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: Colors.primaryDark }]} />
                                    <Text style={styles.legendText}>Your Weight</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
                                    <Text style={styles.legendText}>Target</Text>
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* Add Weight Button/Form */}
                {!showForm ? (
                    <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
                        <Plus size={20} color={Colors.surface} />
                        <Text style={styles.addButtonText}>Log Today's Weight</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Log Weight</Text>
                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.weightInput}
                                value={weight}
                                onChangeText={setWeight}
                                placeholder="0.0"
                                placeholderTextColor={Colors.textMuted}
                                keyboardType="decimal-pad"
                                autoFocus
                            />
                            <Text style={styles.inputUnit}>kg</Text>
                        </View>
                        <TextInput
                            style={styles.notesInput}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Add notes (optional)"
                            placeholderTextColor={Colors.textMuted}
                            multiline
                        />
                        <View style={styles.formButtons}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowForm(false)}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveButton, createMutation.isPending && styles.saveButtonDisabled]}
                                onPress={handleLogWeight}
                                disabled={createMutation.isPending}
                            >
                                {createMutation.isPending ? (
                                    <ActivityIndicator color={Colors.surface} size="small" />
                                ) : (
                                    <Text style={styles.saveButtonText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Weight History */}
                <Text style={styles.sectionTitle}>History</Text>
                {isLoading ? (
                    <ActivityIndicator style={styles.loader} color={Colors.primaryDark} />
                ) : weightLogs && weightLogs.length > 0 ? (
                    <View style={styles.historyList}>
                        {weightLogs.map((log, index) => {
                            const prevLog = weightLogs[index + 1];
                            const delta = prevLog ? log.weightKg - prevLog.weightKg : null;
                            return (
                                <View key={log.id} style={styles.historyItem}>
                                    <View>
                                        <Text style={styles.historyDate}>
                                            {new Date(log.logDate).toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </Text>
                                        {log.notes && <Text style={styles.historyNotes}>{log.notes}</Text>}
                                    </View>
                                    <View style={styles.historyRight}>
                                        <Text style={styles.historyWeight}>{log.weightKg} kg</Text>
                                        {delta !== null && (
                                            <Text style={[styles.historyDelta, delta < 0 ? styles.deltaDown : delta > 0 ? styles.deltaUp : styles.deltaNeutral]}>
                                                {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No weight logs yet</Text>
                        <Text style={styles.emptySubtext}>Start tracking your weight to see progress</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollView: {
        flex: 1,
        padding: Spacing.xl,
    },
    title: {
        fontSize: FontSizes.xxxl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        marginBottom: Spacing.xs,
    },
    subtitle: {
        fontSize: FontSizes.lg,
        color: Colors.textMuted,
        marginBottom: Spacing.xxl,
    },
    currentCard: {
        backgroundColor: Colors.primaryDark,
        borderRadius: BorderRadius.xl,
        padding: Spacing.xxl,
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    currentLabel: {
        fontSize: FontSizes.md,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: Spacing.sm,
    },
    currentValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    currentValue: {
        fontSize: 56,
        fontWeight: FontWeights.bold,
        color: Colors.surface,
    },
    currentUnit: {
        fontSize: 24,
        fontWeight: FontWeights.medium,
        color: 'rgba(255,255,255,0.8)',
        marginLeft: Spacing.xs,
    },
    changeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: 10,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.md,
        marginLeft: Spacing.md,
    },
    changeDown: { backgroundColor: '#d1fae5' },
    changeUp: { backgroundColor: '#fee2e2' },
    changeNeutral: { backgroundColor: Colors.background },
    changeText: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold },
    changeTextDown: { color: '#065f46' },
    changeTextUp: { color: '#991b1b' },
    changeTextNeutral: { color: Colors.textMuted },
    goalCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.xl,
        marginBottom: Spacing.lg,
        ...Shadows.md,
    },
    goalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    goalTitle: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
    },
    goalStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.lg,
    },
    goalStat: {
        flex: 1,
        alignItems: 'center',
    },
    goalStatDivider: {
        width: 1,
        backgroundColor: Colors.border,
    },
    goalStatValue: {
        fontSize: 24,
        fontWeight: FontWeights.bold,
        color: Colors.text,
    },
    goalStatPositive: {
        color: Colors.primaryDark,
    },
    goalStatLabel: {
        fontSize: FontSizes.xs,
        color: Colors.textMuted,
        marginTop: Spacing.xs,
    },
    progressBarContainer: {
        marginTop: Spacing.sm,
    },
    progressBarBackground: {
        height: 8,
        backgroundColor: Colors.border,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: Colors.primaryDark,
        borderRadius: 4,
    },
    progressText: {
        fontSize: FontSizes.xs,
        color: Colors.textMuted,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },
    chartCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        ...Shadows.md,
    },
    chartTitle: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
        marginBottom: Spacing.md,
    },
    chart: {
        marginVertical: Spacing.sm,
        borderRadius: BorderRadius.lg,
    },
    chartLegend: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.xxl,
        marginTop: Spacing.sm,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendText: {
        fontSize: FontSizes.xs,
        color: Colors.textMuted,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.text,
        paddingVertical: Spacing.lg,
        borderRadius: 14,
        marginBottom: Spacing.xxl,
    },
    addButtonText: {
        color: Colors.surface,
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
    },
    formCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.xl,
        marginBottom: Spacing.xxl,
        ...Shadows.md,
    },
    formTitle: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        marginBottom: Spacing.lg,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
    },
    weightInput: {
        flex: 1,
        fontSize: FontSizes.display,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        paddingVertical: Spacing.md,
    },
    inputUnit: {
        fontSize: FontSizes.xl,
        color: Colors.textMuted,
    },
    notesInput: {
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: FontSizes.md,
        color: Colors.text,
        minHeight: 60,
        textAlignVertical: 'top',
        marginBottom: Spacing.lg,
    },
    formButtons: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: Colors.text,
        fontWeight: FontWeights.semibold,
    },
    saveButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primaryDark,
        alignItems: 'center',
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: Colors.surface,
        fontWeight: FontWeights.bold,
    },
    sectionTitle: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        marginBottom: Spacing.lg,
    },
    loader: {
        marginTop: Spacing.xl,
    },
    historyList: {
        gap: Spacing.md,
        paddingBottom: Spacing.xxl,
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
    },
    historyDate: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
    },
    historyNotes: {
        fontSize: FontSizes.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },
    historyRight: {
        alignItems: 'flex-end',
    },
    historyWeight: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.bold,
        color: Colors.text,
    },
    historyDelta: {
        fontSize: FontSizes.xs,
        fontWeight: FontWeights.semibold,
        marginTop: 2,
    },
    deltaDown: { color: Colors.primaryDark },
    deltaUp: { color: Colors.error },
    deltaNeutral: { color: Colors.textMuted },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
        marginBottom: Spacing.xs,
    },
    emptySubtext: {
        fontSize: FontSizes.md,
        color: Colors.textMuted,
    },
});
