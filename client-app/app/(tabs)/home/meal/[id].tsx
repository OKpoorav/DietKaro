import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { X, Camera, Image as ImageIcon, Clock, MessageSquare, CheckCircle, User, Circle, CheckCircle2 } from 'lucide-react-native';
import { useMealLog, useLogMeal } from '../../../../hooks/useMealLog';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights, CommonStyles } from '../../../../constants/theme';
import { useToast } from '../../../../components/Toast';
import { normalizeError } from '../../../../utils/errorHandler';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { MealOption } from '../../../../types';

const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Substituted'] as const;

export default function MealDetailScreen() {
    const { id, status: paramStatus, mealName, mealType, scheduledTime, feedback } = useLocalSearchParams<{
        id: string;
        status?: string;
        mealName?: string;
        mealType?: string;
        scheduledTime?: string;
        feedback?: string;
    }>();
    const router = useRouter();
    const { showToast } = useToast();

    const isPendingMeal = id?.startsWith('pending-');
    const isLoggedMeal = paramStatus === 'eaten' || paramStatus === 'skipped';

    const { data: mealLog, isLoading } = useMealLog(id ?? '');
    const logMutation = useLogMeal();

    const [selectedMealType, setSelectedMealType] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedOption, setSelectedOption] = useState<number>(0);

    const hasAlternatives = mealLog?.meal?.hasAlternatives ?? false;
    const mealOptions: MealOption[] = mealLog?.meal?.options ?? [];

    useEffect(() => {
        if (mealLog?.meal?.mealType) {
            setSelectedMealType(mealLog.meal.mealType.charAt(0).toUpperCase() + mealLog.meal.mealType.slice(1));
        } else if (mealType) {
            setSelectedMealType(mealType.charAt(0).toUpperCase() + mealType.slice(1));
        }
    }, [mealLog, mealType]);

    const handleClose = () => {
        router.back();
    };

    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            showToast({ title: 'Permission Required', message: 'Camera permission is needed to take photos.', variant: 'warning' });
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [3, 2],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setPhotoUri(result.assets[0].uri);
        }
    };

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showToast({ title: 'Permission Required', message: 'Photo library access is needed to select photos.', variant: 'warning' });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [3, 2],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setPhotoUri(result.assets[0].uri);
        }
    };

    const handleSubmit = async () => {
        if (!id) return;

        setIsSubmitting(true);
        try {
            await logMutation.mutateAsync({
                mealLogId: id,
                status: 'eaten',
                notes: notes || undefined,
                photoUri: photoUri || undefined,
                chosenOptionGroup: hasAlternatives ? selectedOption : undefined,
            });
            showToast({ title: 'Success', message: 'Meal logged successfully!', variant: 'success' });
            router.back();
        } catch (error) {
            console.error('Log meal error:', error);
            const appError = normalizeError(error);
            showToast({ title: appError.title, message: appError.message, variant: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isPendingMeal && isLoading) {
        return <LoadingScreen />;
    }

    const currentMealLog = mealLog;
    const dietitianFeedback = currentMealLog?.dietitianFeedback || feedback;
    const mealPhoto = currentMealLog?.mealPhotoUrl;
    const clientNotes = currentMealLog?.clientNotes;
    const displayMealName = currentMealLog?.meal?.name || mealName || 'Meal';
    const displayMealType = currentMealLog?.meal?.mealType || mealType || 'meal';
    const displayTime = currentMealLog?.scheduledTime || scheduledTime;

    if (!isPendingMeal && (currentMealLog?.status === 'eaten' || currentMealLog?.status === 'skipped' || isLoggedMeal)) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                        <X size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Meal Details</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    {/* Meal Photo or Status Icon */}
                    <View style={styles.photoSection}>
                        {mealPhoto ? (
                            <Image source={{ uri: mealPhoto }} style={styles.mealPhoto} />
                        ) : (
                            <View style={styles.statusIconContainer}>
                                <CheckCircle size={48} color={Colors.primary} />
                            </View>
                        )}
                    </View>

                    {/* Meal Info */}
                    <View style={styles.mealInfoCard}>
                        <Text style={styles.mealTypeLabel}>{displayMealType.toUpperCase()}</Text>
                        <Text style={styles.mealNameLarge}>{displayMealName}</Text>
                        {displayTime && (
                            <View style={styles.timeRow}>
                                <Clock size={16} color={Colors.textSecondary} />
                                <Text style={styles.timeText}>{displayTime}</Text>
                            </View>
                        )}

                        {/* Status Badge */}
                        <View style={styles.loggedBadge}>
                            <CheckCircle size={16} color={Colors.primary} />
                            <Text style={styles.loggedBadgeText}>
                                Logged on {new Date(currentMealLog?.loggedAt || Date.now()).toLocaleDateString()}
                            </Text>
                        </View>

                        {/* Chosen Option Badge */}
                        {hasAlternatives && currentMealLog?.chosenOptionGroup != null && (
                            <View style={styles.chosenOptionBadge}>
                                <CheckCircle size={16} color={Colors.primary} />
                                <Text style={styles.chosenOptionText}>
                                    You chose: {mealOptions.find(o => o.optionGroup === currentMealLog.chosenOptionGroup)?.label
                                        || `Option ${String.fromCharCode(65 + (currentMealLog.chosenOptionGroup ?? 0))}`}
                                </Text>
                                <Text style={styles.chosenOptionCalories}>
                                    {mealOptions.find(o => o.optionGroup === currentMealLog.chosenOptionGroup)?.totalCalories ?? 0} kcal
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Client Notes */}
                    {clientNotes && (
                        <View style={styles.notesCard}>
                            <Text style={styles.cardTitle}>Your Notes</Text>
                            <Text style={styles.notesText}>{clientNotes}</Text>
                        </View>
                    )}

                    {/* Dietitian Feedback */}
                    <View style={styles.feedbackCard}>
                        <View style={styles.feedbackHeader}>
                            <MessageSquare size={20} color={Colors.primary} />
                            <Text style={styles.cardTitle}>Dietitian Feedback</Text>
                        </View>

                        {dietitianFeedback ? (
                            <View style={styles.feedbackContent}>
                                <View style={styles.dietitianInfo}>
                                    <View style={styles.dietitianAvatar}>
                                        <User size={16} color={Colors.surface} />
                                    </View>
                                    <Text style={styles.dietitianName}>Your Dietitian</Text>
                                </View>
                                <Text style={styles.feedbackText}>{dietitianFeedback}</Text>
                                {currentMealLog?.dietitianFeedbackAt && (
                                    <Text style={styles.feedbackTime}>
                                        {new Date(currentMealLog.dietitianFeedbackAt).toLocaleString()}
                                    </Text>
                                )}
                            </View>
                        ) : (
                            <View style={styles.noFeedback}>
                                <Text style={styles.noFeedbackText}>
                                    No feedback yet. Your dietitian will review this meal soon.
                                </Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                    <X size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Log Meal</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Photo Section */}
                <View style={styles.photoSection}>
                    {photoUri ? (
                        <TouchableOpacity onPress={handleTakePhoto} activeOpacity={0.8}>
                            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                            <Text style={styles.tapToChange}>Tap to change photo</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.photoPlaceholder}>
                            <View style={styles.photoButtons}>
                                <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto}>
                                    <Camera size={28} color={Colors.primary} />
                                    <Text style={styles.photoButtonText}>Camera</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.photoButton} onPress={handlePickImage}>
                                    <ImageIcon size={28} color={Colors.primary} />
                                    <Text style={styles.photoButtonText}>Gallery</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* Option Selector — shown when meal has alternatives */}
                {hasAlternatives && mealOptions.length > 1 && (
                    <View style={styles.optionSection}>
                        <Text style={styles.sectionTitle}>What did you have?</Text>
                        {mealOptions.map((option) => {
                            const isSelected = selectedOption === option.optionGroup;
                            return (
                                <TouchableOpacity
                                    key={option.optionGroup}
                                    style={[
                                        styles.optionCard,
                                        isSelected && styles.optionCardSelected,
                                    ]}
                                    onPress={() => setSelectedOption(option.optionGroup)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.optionHeader}>
                                        <View style={styles.optionRadio}>
                                            {isSelected ? (
                                                <CheckCircle2 size={22} color={Colors.primary} />
                                            ) : (
                                                <Circle size={22} color={Colors.border} />
                                            )}
                                        </View>
                                        <View style={styles.optionLabelRow}>
                                            <Text style={[
                                                styles.optionLabel,
                                                isSelected && styles.optionLabelSelected,
                                            ]}>
                                                {option.label || `Option ${String.fromCharCode(65 + option.optionGroup)}`}
                                            </Text>
                                            <Text style={styles.optionCalories}>
                                                {option.totalCalories} kcal
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.optionFoods}>
                                        {option.foodItems.map((fi, idx) => (
                                            <Text key={fi.id || idx} style={styles.optionFoodItem}>
                                                {fi.foodName} {fi.quantityG}g
                                            </Text>
                                        ))}
                                    </View>
                                    <View style={styles.optionMacros}>
                                        <Text style={styles.optionMacroText}>{option.totalProteinG}g P</Text>
                                        <View style={styles.optionMacroDot} />
                                        <Text style={styles.optionMacroText}>{option.totalCarbsG}g C</Text>
                                        <View style={styles.optionMacroDot} />
                                        <Text style={styles.optionMacroText}>{option.totalFatsG}g F</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Meal Type Selection */}
                <Text style={styles.sectionTitle}>Meal Type</Text>
                <View style={styles.mealTypeContainer}>
                    {mealTypes.map((type) => (
                        <TouchableOpacity
                            key={type}
                            style={[
                                styles.mealTypeButton,
                                selectedMealType === type && styles.mealTypeButtonSelected,
                            ]}
                            onPress={() => setSelectedMealType(type)}
                        >
                            <Text
                                style={[
                                    styles.mealTypeText,
                                    selectedMealType === type && styles.mealTypeTextSelected,
                                ]}
                            >
                                {type}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Scheduled Time */}
                {scheduledTime && (
                    <View style={styles.timeContainer}>
                        <Text style={styles.inputLabel}>Scheduled Time</Text>
                        <View style={styles.timeDisplay}>
                            <Clock size={18} color={Colors.textSecondary} />
                            <Text style={styles.scheduledTimeText}>{scheduledTime}</Text>
                        </View>
                    </View>
                )}

                {/* Notes Input */}
                <View style={styles.notesContainer}>
                    <Text style={styles.inputLabel}>Notes (Optional)</Text>
                    <TextInput
                        style={styles.notesInput}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Add any notes about your meal"
                        placeholderTextColor={Colors.textSecondary}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                </View>
            </ScrollView>

            {/* Submit Button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[CommonStyles.primaryButton, isSubmitting && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color={Colors.text} />
                    ) : (
                        <Text style={CommonStyles.primaryButtonText}>Submit</Text>
                    )}
                </TouchableOpacity>
            </View>
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
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
    },
    headerSpacer: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    photoSection: {
        paddingVertical: Spacing.lg,
    },
    mealPhoto: {
        width: '100%',
        aspectRatio: 3 / 2,
        backgroundColor: Colors.surfaceSecondary,
    },
    statusIconContainer: {
        width: '100%',
        aspectRatio: 3 / 2,
        backgroundColor: Colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    photoPreview: {
        width: '100%',
        aspectRatio: 3 / 2,
        backgroundColor: Colors.surfaceSecondary,
    },
    tapToChange: {
        textAlign: 'center',
        color: Colors.textSecondary,
        fontSize: FontSizes.md,
        marginTop: Spacing.sm,
    },
    photoPlaceholder: {
        width: '100%',
        aspectRatio: 3 / 2,
        backgroundColor: Colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    photoButtons: {
        flexDirection: 'row',
        gap: 48,
    },
    photoButton: {
        alignItems: 'center',
        gap: Spacing.sm,
    },
    photoButtonText: {
        fontSize: FontSizes.md,
        color: Colors.text,
        fontWeight: FontWeights.medium,
    },
    mealInfoCard: {
        backgroundColor: Colors.surface,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    mealTypeLabel: {
        fontSize: FontSizes.xs,
        fontWeight: FontWeights.semibold,
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
    },
    mealNameLarge: {
        fontSize: FontSizes.xxl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: Spacing.md,
    },
    timeText: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
    },
    loggedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.surfaceSecondary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.sm,
        alignSelf: 'flex-start',
    },
    loggedBadgeText: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
    },
    notesCard: {
        backgroundColor: Colors.surface,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    cardTitle: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
        marginBottom: Spacing.md,
    },
    notesText: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    feedbackCard: {
        backgroundColor: Colors.surface,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.xxl,
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    feedbackHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    feedbackContent: {
        backgroundColor: Colors.surfaceSecondary,
        padding: Spacing.md,
        borderRadius: BorderRadius.sm,
    },
    dietitianInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    dietitianAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dietitianName: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
    },
    feedbackText: {
        fontSize: FontSizes.md,
        color: Colors.text,
        lineHeight: 20,
    },
    feedbackTime: {
        fontSize: FontSizes.xs,
        color: Colors.textSecondary,
        marginTop: Spacing.sm,
    },
    noFeedback: {
        backgroundColor: Colors.surfaceSecondary,
        padding: Spacing.lg,
        borderRadius: BorderRadius.sm,
        alignItems: 'center',
    },
    noFeedbackText: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.sm,
    },
    mealTypeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    mealTypeButton: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: 10,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.surface,
    },
    mealTypeButtonSelected: {
        borderWidth: 2,
        borderColor: Colors.primary,
    },
    mealTypeText: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.medium,
        color: Colors.text,
    },
    mealTypeTextSelected: {
        fontWeight: FontWeights.semibold,
    },
    timeContainer: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    inputLabel: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.medium,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    timeDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.surfaceSecondary,
        padding: Spacing.lg,
        borderRadius: BorderRadius.sm,
    },
    scheduledTimeText: {
        fontSize: FontSizes.lg,
        color: Colors.textSecondary,
    },
    notesContainer: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    notesInput: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.sm,
        padding: Spacing.lg,
        fontSize: FontSizes.lg,
        color: Colors.text,
        minHeight: 100,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    footer: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        paddingBottom: Spacing.xxl,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    // Option Selector styles
    optionSection: {
        paddingBottom: Spacing.md,
    },
    optionCard: {
        backgroundColor: Colors.surface,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1.5,
        borderColor: Colors.border,
    },
    optionCardSelected: {
        borderColor: Colors.primary,
        backgroundColor: '#f0fdf4',
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    optionRadio: {
        marginRight: Spacing.md,
    },
    optionLabelRow: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    optionLabel: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
    },
    optionLabelSelected: {
        color: Colors.primary,
    },
    optionCalories: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.semibold,
        color: Colors.textSecondary,
    },
    optionFoods: {
        marginLeft: 38,
        marginBottom: Spacing.sm,
    },
    optionFoodItem: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    optionMacros: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 38,
        gap: 6,
    },
    optionMacroText: {
        fontSize: FontSizes.xs,
        color: Colors.textSecondary,
    },
    optionMacroDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: Colors.border,
    },
    // Chosen option badge in logged view
    chosenOptionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: '#f0fdf4',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.sm,
        marginTop: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    chosenOptionText: {
        fontSize: FontSizes.sm,
        fontWeight: FontWeights.semibold,
        color: Colors.primary,
        flex: 1,
    },
    chosenOptionCalories: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
    },
});
