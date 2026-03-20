import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMealsByDateRange, useClientStats, usePlanSocket } from '../../../hooks/useMeals';
import { useDailyAdherence } from '../../../hooks/useAdherence';
import { Clock, Camera, Check, AlertCircle, MessageSquare, CalendarOff, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState, useMemo } from 'react';
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

                {meal?.name && meal.name.toLowerCase() !== meal.mealType?.toLowerCase() && (
                <View style={styles.mealNameRow}>
                    <Text style={styles.mealName} numberOfLines={1}>{meal.name}</Text>
                    {meal?.hasAlternatives && (
                        <View style={styles.optionsBadge}>
                            <Text style={styles.optionsBadgeText}>
                                {(meal.options?.length || 2)} options
                            </Text>
                        </View>
                    )}
                </View>
                )}

                {scheduledTime && (
                    <View style={styles.timeRow}>
                        <Clock size={14} color={Colors.textSecondary} />
                        <Text style={styles.timeText}>{scheduledTime}</Text>
                    </View>
                )}

                {/* Food items */}
                {meal?.foodItems && meal.foodItems.length > 0 && (
                    <Text style={styles.foodItemsText} numberOfLines={2}>
                        {meal.foodItems.map((fi: any) => `${fi.foodName} ${fi.quantityG}g`).join(' · ')}
                    </Text>
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

// Helper to get week dates starting from Monday
function getWeekDates(baseDate: Date): Date[] {
    const date = new Date(baseDate);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday as start
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    monday.setHours(0, 0, 0, 0);

    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        week.push(d);
    }
    return week;
}

function WeekCalendar({ selectedDate, onSelectDate }: { selectedDate: Date; onSelectDate: (date: Date) => void }) {
    const [weekStart, setWeekStart] = useState(() => {
        const d = new Date(selectedDate);
        d.setHours(0, 0, 0, 0);
        return d;
    });

    const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

    const goToPreviousWeek = () => {
        const newDate = new Date(weekStart);
        newDate.setDate(newDate.getDate() - 7);
        setWeekStart(newDate);
    };

    const goToNextWeek = () => {
        const newDate = new Date(weekStart);
        newDate.setDate(newDate.getDate() + 7);
        setWeekStart(newDate);
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const isSelected = (date: Date) => {
        return date.toDateString() === selectedDate.toDateString();
    };

    return (
        <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
                <TouchableOpacity onPress={goToPreviousWeek} style={styles.weekNavButton}>
                    <ChevronLeft size={20} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.weekLabel}>
                    {weekDates[0].toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </Text>
                <TouchableOpacity onPress={goToNextWeek} style={styles.weekNavButton}>
                    <ChevronRight size={20} color={Colors.text} />
                </TouchableOpacity>
            </View>
            <View style={styles.weekDays}>
                {weekDates.map((date, index) => {
                    const selected = isSelected(date);
                    const today = isToday(date);
                    return (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.dayButton,
                                selected && styles.dayButtonSelected,
                                today && !selected && styles.dayButtonToday,
                            ]}
                            onPress={() => onSelectDate(date)}
                        >
                            <Text style={[
                                styles.dayLabel,
                                selected && styles.dayLabelSelected,
                            ]}>
                                {date.toLocaleDateString('en-US', { weekday: 'narrow' })}
                            </Text>
                            <Text style={[
                                styles.dayNumber,
                                selected && styles.dayNumberSelected,
                            ]}>
                                {date.getDate()}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

export default function HomeScreen() {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });

    // Get week start and end for the selected week
    const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
    const startDate = weekDates[0].toISOString().split('T')[0];
    const endDate = weekDates[6].toISOString().split('T')[0];

    usePlanSocket();
    const { data: allMeals, isLoading, refetch } = useMealsByDateRange(startDate, endDate);
    const { data: stats } = useClientStats();
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    const { data: dailyAdherence } = useDailyAdherence(selectedDateStr);
    const [refreshing, setRefreshing] = useState(false);

    // Filter meals for the selected date
    const mealsForSelectedDate = useMemo(() => {
        if (!allMeals) return [];
        return allMeals.filter(m => m.scheduledDate === selectedDateStr);
    }, [allMeals, selectedDateStr]);

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    const formattedDate = selectedDate.toLocaleDateString('en-US', {
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
                    <Text style={styles.dateText}>{formattedDate}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    
                        <View style={styles.streakBadge}>
                            <Text style={styles.streakText}>🔥 {stats?.currentStreak || 0} day streak</Text>
                        </View>
                    </View>
                </View>

                {/* Week Calendar */}
                <WeekCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />

                {/* Stats Cards */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats?.currentStreak || 0}</Text>
                        <Text style={styles.statLabel}>Day streak</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statValue, dailyAdherence ? {
                            color: dailyAdherence.color === 'GREEN' ? '#17cf54' :
                                dailyAdherence.color === 'YELLOW' ? '#EAB308' : '#EF4444'
                        } : {}]}>
                            {dailyAdherence?.score ?? (stats?.weeklyAdherence || 0)}%
                        </Text>
                        <Text style={styles.statLabel}>Today&apos;s score</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats?.weeklyAdherence || 0}%</Text>
                        <Text style={styles.statLabel}>This week</Text>
                    </View>
                </View>

                {/* Selected Day's Meals */}
                <Text style={styles.sectionTitle}>Meals</Text>

                {mealsForSelectedDate && mealsForSelectedDate.length > 0 ? (
                    <View style={styles.mealsContainer}>
                        {mealsForSelectedDate.map((mealLog) => (
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
                        title="No meals scheduled"
                        subtitle="No meals for this day"
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
    calendarContainer: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    calendarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    weekNavButton: {
        padding: Spacing.sm,
    },
    weekLabel: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
    },
    weekDays: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    dayButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    dayButtonSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    dayButtonToday: {
        borderColor: Colors.primary,
        borderWidth: 2,
    },
    dayLabel: {
        fontSize: FontSizes.xs,
        color: Colors.textSecondary,
        marginBottom: 4,
        fontWeight: FontWeights.medium,
    },
    dayLabelSelected: {
        color: Colors.surface,
    },
    dayNumber: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.bold,
        color: Colors.text,
    },
    dayNumberSelected: {
        color: Colors.surface,
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
    mealNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.xs,
    },
    mealName: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        flexShrink: 1,
    },
    optionsBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    optionsBadgeText: {
        fontSize: 10,
        fontWeight: FontWeights.semibold,
        color: '#3B82F6',
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
    foodItemsText: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
    },
    logButton: {
        width: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.primary,
    },
});
