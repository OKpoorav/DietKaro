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
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useProgressSummary, useCreateWeightLog } from '../../../hooks/useWeight';
import { useWeeklyAdherence } from '../../../hooks/useAdherence';
import { useToast } from '../../../components/Toast';
import { ArrowLeft, PencilLine, TrendingUp, TrendingDown, Minus, Ruler, ChevronRight } from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, Shadows } from '../../../constants/theme';

const screenWidth = Dimensions.get('window').width;

export default function ProgressScreen() {
    const router = useRouter();
    const { data: progress } = useProgressSummary();
    const { data: weeklyAdherence } = useWeeklyAdherence();
    const createWeightMutation = useCreateWeightLog();
    const { showToast } = useToast();

    const [showWeightModal, setShowWeightModal] = useState(false);
    const [weightInput, setWeightInput] = useState('');

    // All data computed server-side
    const currentWeight = progress?.currentWeight;
    const targetWeight = progress?.targetWeight ?? 65;
    const progressPercent = progress?.progressPercent ?? 0;
    const chartEntries = progress?.chartEntries ?? [];
    const hasChartData = chartEntries.length >= 2;
    const history = progress?.history ?? [];

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
                    <Text style={styles.chartPeriod}>
                        {hasChartData ? `Last ${chartEntries.length} entries` : 'No data yet'}
                    </Text>

                    {hasChartData ? (
                        <View style={styles.chartContainer}>
                            <LineChart
                                data={{
                                    labels: chartEntries.map(d => {
                                        const date = new Date(d.date);
                                        return `${date.getDate()}/${date.getMonth() + 1}`;
                                    }),
                                    datasets: [
                                        {
                                            data: chartEntries.map(d => d.weight),
                                            color: (opacity = 1) => `rgba(23, 207, 84, ${opacity})`,
                                            strokeWidth: 2,
                                        },
                                        ...(targetWeight ? [{
                                            data: chartEntries.map(() => targetWeight),
                                            color: (opacity = 1) => `rgba(239, 68, 68, ${opacity * 0.4})`,
                                            strokeWidth: 1,
                                            withDots: false,
                                        }] : []),
                                    ],
                                }}
                                width={screenWidth - Spacing.lg * 4}
                                height={180}
                                chartConfig={{
                                    backgroundColor: Colors.surfaceSecondary,
                                    backgroundGradientFrom: Colors.surfaceSecondary,
                                    backgroundGradientTo: Colors.surfaceSecondary,
                                    decimalPlaces: 1,
                                    color: (opacity = 1) => `rgba(17, 24, 39, ${opacity})`,
                                    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                                    style: { borderRadius: 12 },
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
                                style={{ borderRadius: 12 }}
                            />
                            {targetWeight && (
                                <View style={styles.chartLegend}>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#17cf54' }]} />
                                        <Text style={styles.legendText}>Weight</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                                        <Text style={styles.legendText}>Target</Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    ) : (
                        <View style={styles.chartPlaceholder}>
                            <Text style={styles.chartEmptyText}>
                                Log at least 2 weights to see your trend
                            </Text>
                        </View>
                    )}
                </View>

                {/* Goal Progress */}
                <View style={styles.goalSection}>
                    <Text style={styles.goalLabel}>Goal: {targetWeight} kg</Text>
                    <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
                    </View>
                    <Text style={styles.toGoText}>
                        {progress?.remaining !== null && progress?.remaining !== undefined
                            ? `${progress.remaining} kg to go`
                            : 'Set your goal weight'}
                    </Text>
                </View>

                {/* Weight History */}
                {history.length > 0 && (
                    <View style={styles.historySection}>
                        <Text style={styles.sectionLabel}>Recent Entries</Text>
                        <View style={styles.historyList}>
                            {history.map((entry) => (
                                <View key={entry.id} style={styles.historyItem}>
                                    <Text style={styles.historyDate}>
                                        {new Date(entry.logDate).toLocaleDateString('en-US', {
                                            weekday: 'short', month: 'short', day: 'numeric',
                                        })}
                                    </Text>
                                    <View style={styles.historyRight}>
                                        <Text style={styles.historyWeight}>{entry.weightKg} kg</Text>
                                        {entry.delta !== null && (
                                            <Text style={[
                                                styles.historyDelta,
                                                entry.delta < 0 ? styles.deltaDown : entry.delta > 0 ? styles.deltaUp : styles.deltaNeutral,
                                            ]}>
                                                {entry.delta > 0 ? '+' : ''}{entry.delta.toFixed(1)} kg
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Body Profile Card */}
                <TouchableOpacity
                    style={styles.bodyProfileCard}
                    onPress={() => router.push('/(tabs)/profile/body-profile')}
                    activeOpacity={0.7}
                >
                    <View style={styles.bodyProfileIcon}>
                        <Ruler size={20} color={Colors.primaryDark} />
                    </View>
                    <View style={styles.bodyProfileText}>
                        <Text style={styles.bodyProfileTitle}>Body Profile</Text>
                        <Text style={styles.bodyProfileSubtitle}>Height, measurements & activity level</Text>
                    </View>
                    <ChevronRight size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                {/* Adherence Section */}
                {weeklyAdherence && (
                    <View style={styles.adherenceSection}>
                        <Text style={styles.sectionLabel}>Weekly Adherence</Text>
                        <View style={styles.adherenceHeader}>
                            <Text style={[
                                styles.adherenceScore,
                                { color: weeklyAdherence.color === 'GREEN' ? '#17cf54' :
                                    weeklyAdherence.color === 'YELLOW' ? '#EAB308' : '#EF4444' }
                            ]}>
                                {weeklyAdherence.averageScore}%
                            </Text>
                            <View style={styles.trendBadge}>
                                {weeklyAdherence.trend === 'improving' && <TrendingUp size={16} color="#17cf54" />}
                                {weeklyAdherence.trend === 'declining' && <TrendingDown size={16} color="#EF4444" />}
                                {weeklyAdherence.trend === 'stable' && <Minus size={16} color={Colors.textSecondary} />}
                                <Text style={[styles.trendText, {
                                    color: weeklyAdherence.trend === 'improving' ? '#17cf54' :
                                        weeklyAdherence.trend === 'declining' ? '#EF4444' : Colors.textSecondary
                                }]}>
                                    {weeklyAdherence.trend.charAt(0).toUpperCase() + weeklyAdherence.trend.slice(1)}
                                </Text>
                            </View>
                        </View>

                        {/* 7-day bar chart */}
                        <View style={styles.adherenceChart}>
                            {weeklyAdherence.dailyBreakdown.map((day, i) => {
                                const barColor = day.mealsLogged === 0 ? Colors.border :
                                    day.color === 'GREEN' ? '#17cf54' :
                                    day.color === 'YELLOW' ? '#EAB308' : '#EF4444';
                                const dayLabel = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
                                return (
                                    <View key={i} style={styles.adherenceBarContainer}>
                                        <View style={styles.adherenceBarTrack}>
                                            <View style={[
                                                styles.adherenceBar,
                                                { height: `${Math.max(day.score, 4)}%`, backgroundColor: barColor }
                                            ]} />
                                        </View>
                                        <Text style={styles.adherenceDayLabel}>{dayLabel}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}
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
    chartContainer: {
        marginBottom: Spacing.sm,
    },
    chartPlaceholder: {
        height: 180,
        backgroundColor: Colors.surfaceSecondary,
        borderRadius: BorderRadius.sm,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    chartEmptyText: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
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
    historySection: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    historyList: {
        marginTop: Spacing.sm,
        gap: Spacing.sm,
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    historyDate: {
        fontSize: FontSizes.sm,
        fontWeight: FontWeights.medium,
        color: Colors.text,
    },
    historyRight: {
        alignItems: 'flex-end',
    },
    historyWeight: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.bold,
        color: Colors.text,
    },
    historyDelta: {
        fontSize: FontSizes.xs,
        fontWeight: FontWeights.semibold,
        marginTop: 2,
    },
    deltaDown: { color: '#17cf54' },
    deltaUp: { color: '#EF4444' },
    deltaNeutral: { color: Colors.textSecondary },
    bodyProfileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        marginHorizontal: Spacing.lg,
        marginVertical: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    bodyProfileIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    bodyProfileText: {
        flex: 1,
    },
    bodyProfileTitle: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
    },
    bodyProfileSubtitle: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    adherenceSection: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.xxl,
    },
    adherenceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    adherenceScore: {
        fontSize: FontSizes.display,
        fontWeight: FontWeights.bold,
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.surfaceSecondary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    trendText: {
        fontSize: FontSizes.sm,
        fontWeight: FontWeights.semibold,
    },
    adherenceChart: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 120,
        gap: 6,
    },
    adherenceBarContainer: {
        flex: 1,
        alignItems: 'center',
    },
    adherenceBarTrack: {
        width: '100%',
        height: 100,
        backgroundColor: Colors.surfaceSecondary,
        borderRadius: 4,
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    adherenceBar: {
        width: '100%',
        borderRadius: 4,
    },
    adherenceDayLabel: {
        fontSize: FontSizes.xs,
        color: Colors.textSecondary,
        marginTop: 4,
        fontWeight: FontWeights.bold,
    },
});
