import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MealLog } from '../types';
import { Clock, Check, X, MessageCircle, Camera } from 'lucide-react-native';

interface MealCardProps {
    mealLog: MealLog;
}

const mealTypeEmoji: Record<string, string> = {
    breakfast: '🌅',
    lunch: '☀️',
    snack: '🍎',
    dinner: '🌙',
};

const statusConfig = {
    pending: { bg: '#fef3c7', text: '#92400e', label: 'Pending' },
    eaten: { bg: '#d1fae5', text: '#065f46', label: 'Logged' },
    skipped: { bg: '#fee2e2', text: '#991b1b', label: 'Skipped' },
    substituted: { bg: '#dbeafe', text: '#1e40af', label: 'Substituted' },
};

export function MealCard({ mealLog }: MealCardProps) {
    const router = useRouter();
    const { meal, status, dietitianFeedback, scheduledTime } = mealLog;
    const config = statusConfig[status];

    const handlePress = () => {
        // Navigate to meal detail/logging screen
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
                    <MessageCircle size={14} color="#6366f1" />
                    <Text style={styles.feedbackText} numberOfLines={2}>{dietitianFeedback}</Text>
                </View>
            )}

            {/* Action Button for pending */}
            {status === 'pending' && (
                <TouchableOpacity style={styles.logButton} onPress={handlePress}>
                    <Camera size={18} color="#fff" />
                    <Text style={styles.logButtonText}>Log This Meal</Text>
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
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
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    time: {
        fontSize: 12,
        color: '#9ca3af',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    mealName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    description: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 12,
        lineHeight: 20,
    },
    macrosRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    macroItem: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 2,
    },
    macroValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    macroLabel: {
        fontSize: 11,
        color: '#9ca3af',
    },
    macroDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#d1d5db',
    },
    photoPreview: {
        width: '100%',
        height: 120,
        borderRadius: 12,
        marginBottom: 12,
    },
    feedbackContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#eef2ff',
        padding: 12,
        borderRadius: 12,
        marginTop: 8,
    },
    feedbackText: {
        flex: 1,
        fontSize: 13,
        color: '#4f46e5',
        lineHeight: 18,
    },
    logButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#17cf54',
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 12,
    },
    logButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
});
