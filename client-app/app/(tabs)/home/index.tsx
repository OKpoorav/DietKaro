import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTodayMeals, useClientStats } from '../../../hooks/useMeals';
import { Clock, Camera, Check, AlertCircle, MessageSquare } from 'lucide-react-native';
import { useState } from 'react';
import { MealLog } from '../../../types';

// Figma Design Colors
const colors = {
    background: '#f8fcf9',
    primary: '#13ec5b',
    text: '#0d1b12',
    textSecondary: '#4c9a66',
    border: '#cfe7d7',
    surface: '#e7f3eb',
    white: '#ffffff',
};

interface MealCardProps {
    mealLog: MealLog;
    onPress: () => void;
}

function MealCardV2({ mealLog, onPress }: MealCardProps) {
    const { meal, status, scheduledTime, dietitianFeedback } = mealLog;

    const getStatusInfo = () => {
        // If eaten but no feedback yet = Under Review
        // If eaten with feedback = Reviewed  
        // If skipped = Skipped
        // Otherwise = Pending
        if (status === 'eaten') {
            if (dietitianFeedback) {
                return { color: '#8b5cf6', icon: MessageSquare, label: 'Reviewed' };
            }
            return { color: '#f59e0b', icon: Clock, label: 'Under Review' };
        }
        if (status === 'skipped') {
            return { color: '#ef4444', icon: AlertCircle, label: 'Skipped' };
        }
        return { color: colors.textSecondary, icon: Clock, label: 'Pending' };
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
                        <Camera size={32} color={colors.textSecondary} />
                    </View>
                )}
            </View>

            {/* Meal Info */}
            <View style={styles.mealInfo}>
                <View style={styles.mealHeader}>
                    <Text style={styles.mealType}>
                        {meal?.mealType?.charAt(0).toUpperCase() + meal?.mealType?.slice(1) || 'Meal'}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                        <statusInfo.icon size={12} color={statusInfo.color} />
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>
                            {statusInfo.label}
                        </Text>
                    </View>
                </View>

                <Text style={styles.mealName} numberOfLines={1}>{meal?.name || 'Meal'}</Text>

                {scheduledTime && (
                    <View style={styles.timeRow}>
                        <Clock size={14} color={colors.textSecondary} />
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
                        <MessageSquare size={14} color={colors.primary} />
                        <Text style={styles.feedbackText} numberOfLines={1}>{dietitianFeedback}</Text>
                    </View>
                )}
            </View>

            {/* Log Button for pending meals */}
            {status === 'pending' && (
                <TouchableOpacity style={styles.logButton} onPress={onPress}>
                    <Camera size={18} color={colors.text} />
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

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                style={styles.scrollView}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
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

                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Loading meals...</Text>
                    </View>
                ) : meals && meals.length > 0 ? (
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
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No meals scheduled for today</Text>
                        <Text style={styles.emptySubtext}>Your dietitian will add your meal plan soon</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollView: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    dateText: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 8,
    },
    streakBadge: {
        alignSelf: 'flex-start',
    },
    streakText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text,
    },
    statLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.text,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    mealsContainer: {
        paddingHorizontal: 16,
        gap: 12,
        paddingBottom: 24,
    },
    mealCard: {
        backgroundColor: colors.white,
        borderRadius: 16,
        flexDirection: 'row',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
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
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mealInfo: {
        flex: 1,
        padding: 12,
    },
    mealHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    mealType: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
    },
    mealName: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 4,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    timeText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    macrosRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    macroText: {
        fontSize: 11,
        color: colors.textSecondary,
    },
    macroDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: colors.border,
    },
    feedbackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
        padding: 6,
        backgroundColor: colors.surface,
        borderRadius: 6,
    },
    feedbackText: {
        fontSize: 11,
        color: colors.primary,
        flex: 1,
    },
    logButton: {
        width: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.primary,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingText: {
        color: colors.textSecondary,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});
