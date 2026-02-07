import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTodayMeals, useClientStats } from '../../../hooks/useMeals';
import { Clock, Camera, Check, AlertCircle, MessageSquare, CalendarOff } from 'lucide-react-native';
import { useState } from 'react';
import { MealLog } from '../../../types';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, StatusColors } from '../../../constants/theme';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { EmptyState } from '../../../components/EmptyState';

interface MealCardProps {
    mealLog: MealLog;
    onPress: () => void;
}

function MealCardV2({ mealLog, onPress }: MealCardProps) {
    const { meal, status, scheduledTime, dietitianFeedback } = mealLog;

    const getStatusInfo = () => {
        if (status === 'eaten') {
            if (dietitianFeedback) {
                return { color: StatusColors.reviewed.text, bgColor: StatusColors.reviewed.bg, icon: MessageSquare, label: StatusColors.reviewed.label };
            }
            return { color: StatusColors.underReview.text, bgColor: StatusColors.underReview.bg, icon: Clock, label: StatusColors.underReview.label };
        }
        if (status === 'skipped') {
            return { color: StatusColors.skipped.text, bgColor: StatusColors.skipped.bg, icon: AlertCircle, label: StatusColors.skipped.label };
        }
        return { color: StatusColors.pending.text, bgColor: StatusColors.pending.bg, icon: Clock, label: StatusColors.pending.label };
    };

    const statusInfo = getStatusInfo();

    return (
        <TouchableOpacity style={styles.mealCard} onPress={onPress} activeOpacity={0.8}>
            {/* Meal Image */}
            <View style={styles.mealImageContainer}>
                {mealLog.mealPhotoUrl ? (
                    <Image source={{ uri: mealLog.mealPhotoUrl }} style={styles.mealImage} />
                ) : (
                    <View style={styles.mealImagePlaceholder}>
                        <Camera size={32} color={Colors.textSecondary} />
                    </View>
                )}
            </View>

            {/* Meal Info */}
            <View style={styles.mealInfo}>
                <View style={styles.mealHeader}>
                    <Text style={styles.mealType}>
                        {meal?.mealType?.charAt(0).toUpperCase() + meal?.mealType?.slice(1) || 'Meal'}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
                        <statusInfo.icon size={12} color={statusInfo.color} />
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>
                            {statusInfo.label}
                        </Text>
                    </View>
                </View>

                <Text style={styles.mealName} numberOfLines={1}>{meal?.name || 'Meal'}</Text>

                {scheduledTime && (
                    <View style={styles.timeRow}>
                        <Clock size={14} color={Colors.textSecondary} />
                        <Text style={styles.timeText}>{scheduledTime}</Text>
                    </View>
                )}

                {/* Macros */}
                <View style={styles.macrosRow}>
                    <Text style={styles.macroText}>{meal?.totalCalories || 0} kcal</Text>
                    <View style={styles.macroDot} />
                    <Text style={styles.macroText}>{meal?.totalProteinG || 0}g P</Text>
                    <View style={styles.macroDot} />
                    <Text style={styles.macroText}>{meal?.totalCarbsG || 0}g C</Text>
                </View>

                {/* Dietitian Feedback */}
                {dietitianFeedback && (
                    <View style={styles.feedbackRow}>
                        <MessageSquare size={14} color={Colors.primary} />
                        <Text style={styles.feedbackText} numberOfLines={1}>{dietitianFeedback}</Text>
                    </View>
                )}
            </View>

            {/* Log Button for pending meals */}
            {status === 'pending' && (
                <TouchableOpacity style={styles.logButton} onPress={onPress}>
                    <Camera size={18} color={Colors.text} />
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
}

export default function HomeScreen() {
    const router = useRouter();
    const { data: meals, isLoading, refetch } = useTodayMeals();
    const { data: stats } = useClientStats();
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    const handleMealPress = (mealLog: MealLog) => {
        router.push({
            pathname: '/(tabs)/home/meal/[id]',
            params: {
                id: mealLog.id,
                status: mealLog.status,
                mealName: mealLog.meal?.name || '',
                mealType: mealLog.meal?.mealType || '',
                scheduledTime: mealLog.scheduledTime || '',
                feedback: mealLog.dietitianFeedback || '',
            },
        });
    };

    if (isLoading) {
        return <LoadingScreen message="Loading meals..." />;
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                style={styles.scrollView}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.dateText}>{today}</Text>
                    <View style={styles.streakBadge}>
                        <Text style={styles.streakText}>🔥 {stats?.currentStreak || 0} day streak</Text>
                    </View>
                </View>

                {/* Stats Cards */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats?.currentStreak || 0}</Text>
                        <Text style={styles.statLabel}>Adherence streak</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats?.weeklyAdherence || 0}%</Text>
                        <Text style={styles.statLabel}>On track this week</Text>
                    </View>
                </View>

                {/* Today's Meals */}
                <Text style={styles.sectionTitle}>Today's Meals</Text>

                {meals && meals.length > 0 ? (
                    <View style={styles.mealsContainer}>
                        {meals.map((mealLog) => (
                            <MealCardV2
                                key={mealLog.id}
                                mealLog={mealLog}
                                onPress={() => handleMealPress(mealLog)}
                            />
                        ))}
                    </View>
                ) : (
                    <EmptyState
                        icon={<CalendarOff size={48} color={Colors.textSecondary} />}
                        title="No meals scheduled for today"
                        subtitle="Your dietitian will add your meal plan soon"
                    />
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
    },
    header: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
    },
    dateText: {
        fontSize: FontSizes.xxl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    streakBadge: {
        alignSelf: 'flex-start',
    },
    streakText: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
    },
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.lg,
        gap: Spacing.md,
        marginBottom: Spacing.xxl,
    },
    statCard: {
        flex: 1,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: FontWeights.bold,
        color: Colors.text,
    },
    statLabel: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: FontSizes.xxl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    mealsContainer: {
        paddingHorizontal: Spacing.lg,
        gap: Spacing.md,
        paddingBottom: Spacing.xxl,
    },
    mealCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        flexDirection: 'row',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    mealImageContainer: {
        width: 100,
        height: 100,
    },
    mealImage: {
        width: '100%',
        height: '100%',
    },
    mealImagePlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: Colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mealInfo: {
        flex: 1,
        padding: Spacing.md,
    },
    mealHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    mealType: {
        fontSize: FontSizes.xs,
        fontWeight: FontWeights.semibold,
        color: Colors.textSecondary,
        textTransform: 'uppercase',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: 10,
    },
    statusText: {
        fontSize: 10,
        fontWeight: FontWeights.semibold,
    },
    mealName: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        marginBottom: Spacing.xs,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.xs,
    },
    timeText: {
        fontSize: FontSizes.xs,
        color: Colors.textSecondary,
    },
    macrosRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    macroText: {
        fontSize: 11,
        color: Colors.textSecondary,
    },
    macroDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: Colors.border,
    },
    feedbackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginTop: 6,
        padding: 6,
        backgroundColor: Colors.surfaceSecondary,
        borderRadius: 6,
    },
    feedbackText: {
        fontSize: 11,
        color: Colors.primary,
        flex: 1,
    },
    logButton: {
        width: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.primary,
    },
});
