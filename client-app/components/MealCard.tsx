import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MealLog } from '../types';
import { Clock, Check, X, MessageCircle, Camera } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, Shadows, StatusColors } from '../constants/theme';

interface MealCardProps {
    mealLog: MealLog;
}

const mealTypeEmoji: Record<string, string> = {
    breakfast: '🌅',
    lunch: '☀️',
    snack: '🍎',
    dinner: '🌙',
};

export function MealCard({ mealLog }: MealCardProps) {
    const router = useRouter();
    const { meal, status, dietitianFeedback, scheduledTime } = mealLog;
    const config = StatusColors[status];

    const handlePress = () => {
        router.push({
            pathname: '/(tabs)/home/meal/[id]',
            params: { id: mealLog.id },
        });
    };

    return (
        <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
            <View style={styles.header}>
                <View style={styles.mealTypeRow}>
                    <Text style={styles.emoji}>{mealTypeEmoji[meal.mealType] || '🍽️'}</Text>
                    <View>
                        <Text style={styles.mealType}>{meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)}</Text>
                        <Text style={styles.time}>{scheduledTime || meal.timeOfDay || '--:--'}</Text>
                    </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                    <Text style={[styles.statusText, { color: config.text }]}>{config.label}</Text>
                </View>
            </View>

            <Text style={styles.mealName}>{meal.name}</Text>

            {meal.description && (
                <Text style={styles.description} numberOfLines={2}>{meal.description}</Text>
            )}

            {/* Macros */}
            <View style={styles.macrosRow}>
                <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{meal.totalCalories || 0}</Text>
                    <Text style={styles.macroLabel}>kcal</Text>
                </View>
                <View style={styles.macroDot} />
                <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{meal.totalProteinG || 0}g</Text>
                    <Text style={styles.macroLabel}>protein</Text>
                </View>
                <View style={styles.macroDot} />
                <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{meal.totalCarbsG || 0}g</Text>
                    <Text style={styles.macroLabel}>carbs</Text>
                </View>
                <View style={styles.macroDot} />
                <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{meal.totalFatsG || 0}g</Text>
                    <Text style={styles.macroLabel}>fats</Text>
                </View>
            </View>

            {/* Photo preview if logged */}
            {mealLog.mealPhotoUrl && (
                <Image source={{ uri: mealLog.mealPhotoUrl }} style={styles.photoPreview} />
            )}

            {/* Dietitian Feedback */}
            {dietitianFeedback && (
                <View style={styles.feedbackContainer}>
                    <MessageCircle size={14} color={Colors.info} />
                    <Text style={styles.feedbackText} numberOfLines={2}>{dietitianFeedback}</Text>
                </View>
            )}

            {/* Action Button for pending */}
            {status === 'pending' && (
                <TouchableOpacity style={styles.logButton} onPress={handlePress}>
                    <Camera size={18} color={Colors.surface} />
                    <Text style={styles.logButtonText}>Log This Meal</Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        ...Shadows.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    mealTypeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    emoji: {
        fontSize: 28,
    },
    mealType: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
    },
    time: {
        fontSize: FontSizes.xs,
        color: Colors.textMuted,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.md,
    },
    statusText: {
        fontSize: FontSizes.xs,
        fontWeight: FontWeights.semibold,
    },
    mealName: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        marginBottom: Spacing.xs,
    },
    description: {
        fontSize: FontSizes.md,
        color: Colors.textMuted,
        marginBottom: Spacing.md,
        lineHeight: 20,
    },
    macrosRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    macroItem: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 2,
    },
    macroValue: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
    },
    macroLabel: {
        fontSize: 11,
        color: Colors.textMuted,
    },
    macroDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: Colors.border,
    },
    photoPreview: {
        width: '100%',
        height: 120,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.md,
    },
    feedbackContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        backgroundColor: '#eef2ff',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.sm,
    },
    feedbackText: {
        flex: 1,
        fontSize: FontSizes.sm,
        color: Colors.info,
        lineHeight: 18,
    },
    logButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primaryDark,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.md,
    },
    logButtonText: {
        color: Colors.surface,
        fontSize: FontSizes.md,
        fontWeight: FontWeights.bold,
    },
});
