import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWeightLogs, useCreateWeightLog } from '../../../hooks/useWeight';
import { useAuth } from '../../../hooks/useAuth';
import { Plus, TrendingDown, TrendingUp, Minus, Target, Award } from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

export default function WeightScreen() {
    const { data: weightLogs, isLoading } = useWeightLogs(10);
    const { client } = useAuth();
    const createMutation = useCreateWeightLog();
    const [weight, setWeight] = useState('');
    const [notes, setNotes] = useState('');
    const [showForm, setShowForm] = useState(false);

    const handleLogWeight = async () => {
        const weightNum = parseFloat(weight);
        if (isNaN(weightNum) || weightNum < 20 || weightNum > 300) {
            Alert.alert('Invalid Weight', 'Please enter a valid weight between 20-300 kg');
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
            Alert.alert('Success', 'Weight logged successfully!');
        } catch (error) {
            Alert.alert('Error', 'Failed to log weight. Please try again.');
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
                                {change < 0 ? <TrendingDown size={14} color="#065f46" /> : change > 0 ? <TrendingUp size={14} color="#991b1b" /> : <Minus size={14} color="#6b7280" />}
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
                            <Target size={20} color="#17cf54" />
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
                                    <View style={[styles.legendDot, { backgroundColor: '#17cf54' }]} />
                                    <Text style={styles.legendText}>Your Weight</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                                    <Text style={styles.legendText}>Target</Text>
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* Add Weight Button/Form */}
                {!showForm ? (
                    <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
                        <Plus size={20} color="#fff" />
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
                                placeholderTextColor="#9ca3af"
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
                            placeholderTextColor="#9ca3af"
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
                                    <ActivityIndicator color="#fff" size="small" />
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
                    <ActivityIndicator style={styles.loader} color="#17cf54" />
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
        backgroundColor: '#f9fafb',
    },
    scrollView: {
        flex: 1,
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        marginBottom: 24,
    },
    currentCard: {
        backgroundColor: '#17cf54',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        marginBottom: 16,
    },
    currentLabel: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 8,
    },
    currentValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    currentValue: {
        fontSize: 56,
        fontWeight: '700',
        color: '#fff',
    },
    currentUnit: {
        fontSize: 24,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.8)',
        marginLeft: 4,
    },
    changeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 12,
    },
    changeDown: { backgroundColor: '#d1fae5' },
    changeUp: { backgroundColor: '#fee2e2' },
    changeNeutral: { backgroundColor: '#f3f4f6' },
    changeText: { fontSize: 13, fontWeight: '600' },
    changeTextDown: { color: '#065f46' },
    changeTextUp: { color: '#991b1b' },
    changeTextNeutral: { color: '#6b7280' },
    // Goal Card Styles
    goalCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    goalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    goalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    goalStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    goalStat: {
        flex: 1,
        alignItems: 'center',
    },
    goalStatDivider: {
        width: 1,
        backgroundColor: '#e5e7eb',
    },
    goalStatValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
    },
    goalStatPositive: {
        color: '#17cf54',
    },
    goalStatLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
    },
    progressBarContainer: {
        marginTop: 8,
    },
    progressBarBackground: {
        height: 8,
        backgroundColor: '#e5e7eb',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#17cf54',
        borderRadius: 4,
    },
    progressText: {
        fontSize: 12,
        color: '#6b7280',
        textAlign: 'center',
        marginTop: 8,
    },
    // Chart Styles
    chartCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    chartLegend: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 24,
        marginTop: 8,
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
        fontSize: 12,
        color: '#6b7280',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#111827',
        paddingVertical: 16,
        borderRadius: 14,
        marginBottom: 24,
    },
    addButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    formCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    formTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    weightInput: {
        flex: 1,
        fontSize: 32,
        fontWeight: '700',
        color: '#111827',
        paddingVertical: 12,
    },
    inputUnit: {
        fontSize: 18,
        color: '#6b7280',
    },
    notesInput: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        minHeight: 60,
        textAlignVertical: 'top',
        marginBottom: 16,
    },
    formButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#374151',
        fontWeight: '600',
    },
    saveButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#17cf54',
        alignItems: 'center',
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '700',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    loader: {
        marginTop: 20,
    },
    historyList: {
        gap: 12,
        paddingBottom: 24,
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
    },
    historyDate: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    historyNotes: {
        fontSize: 12,
        color: '#9ca3af',
        marginTop: 2,
    },
    historyRight: {
        alignItems: 'flex-end',
    },
    historyWeight: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    historyDelta: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    deltaDown: { color: '#17cf54' },
    deltaUp: { color: '#ef4444' },
    deltaNeutral: { color: '#6b7280' },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#9ca3af',
    },
});
