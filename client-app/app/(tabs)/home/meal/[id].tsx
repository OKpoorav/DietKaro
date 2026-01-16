import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { X, Camera, Image as ImageIcon, Clock, MessageSquare, CheckCircle, User } from 'lucide-react-native';
import { useMealLog, useLogMeal } from '../../../../hooks/useMealLog';

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

    // Check if this is a pending meal (not yet logged)
    const isPendingMeal = id?.startsWith('pending-');
    const isLoggedMeal = paramStatus === 'eaten' || paramStatus === 'skipped';

    // Only fetch if it's an existing meal log (not pending)
    const { data: mealLog, isLoading } = useMealLog(id ?? '');
    const logMutation = useLogMeal();

    const [selectedMealType, setSelectedMealType] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
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
            Alert.alert('Permission Required', 'Photo library access is needed to select photos.');
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
            });
            Alert.alert('Success', 'Meal logged successfully!', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            console.error('Log meal error:', error);
            Alert.alert('Error', 'Failed to log meal. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // For pending meals, show the form immediately without loading
    if (!isPendingMeal && isLoading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

    // Show logged meal view with feedback
    const currentMealLog = mealLog;
    const dietitianFeedback = currentMealLog?.dietitianFeedback || feedback;
    const mealPhoto = currentMealLog?.mealPhotoUrl;
    const clientNotes = currentMealLog?.clientNotes;
    const displayMealName = currentMealLog?.meal?.name || mealName || 'Meal';
    const displayMealType = currentMealLog?.meal?.mealType || mealType || 'meal';
    const displayTime = currentMealLog?.scheduledTime || scheduledTime;

    // If it's an already logged meal, show the feedback view
    if (!isPendingMeal && (currentMealLog?.status === 'eaten' || currentMealLog?.status === 'skipped' || isLoggedMeal)) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                        <X size={24} color={colors.text} />
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
                                <CheckCircle size={48} color={colors.primary} />
                            </View>
                        )}
                    </View>

                    {/* Meal Info */}
                    <View style={styles.mealInfoCard}>
                        <Text style={styles.mealTypeLabel}>{displayMealType.toUpperCase()}</Text>
                        <Text style={styles.mealNameLarge}>{displayMealName}</Text>
                        {displayTime && (
                            <View style={styles.timeRow}>
                                <Clock size={16} color={colors.textSecondary} />
                                <Text style={styles.timeText}>{displayTime}</Text>
                            </View>
                        )}

                        {/* Status Badge */}
                        <View style={styles.loggedBadge}>
                            <CheckCircle size={16} color={colors.primary} />
                            <Text style={styles.loggedBadgeText}>
                                Logged on {new Date(currentMealLog?.loggedAt || Date.now()).toLocaleDateString()}
                            </Text>
                        </View>
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
                            <MessageSquare size={20} color={colors.primary} />
                            <Text style={styles.cardTitle}>Dietitian Feedback</Text>
                        </View>

                        {dietitianFeedback ? (
                            <View style={styles.feedbackContent}>
                                <View style={styles.dietitianInfo}>
                                    <View style={styles.dietitianAvatar}>
                                        <User size={16} color={colors.white} />
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

    // Show meal logging form for pending meals
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                    <X size={24} color={colors.text} />
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
                                    <Camera size={28} color={colors.primary} />
                                    <Text style={styles.photoButtonText}>Camera</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.photoButton} onPress={handlePickImage}>
                                    <ImageIcon size={28} color={colors.primary} />
                                    <Text style={styles.photoButtonText}>Gallery</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

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
                            <Clock size={18} color={colors.textSecondary} />
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
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                </View>
            </ScrollView>

            {/* Submit Button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color={colors.text} />
                    ) : (
                        <Text style={styles.submitButtonText}>Submit</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },
    headerSpacer: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    photoSection: {
        paddingVertical: 16,
    },
    mealPhoto: {
        width: '100%',
        aspectRatio: 3 / 2,
        backgroundColor: colors.surface,
    },
    statusIconContainer: {
        width: '100%',
        aspectRatio: 3 / 2,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    photoPreview: {
        width: '100%',
        aspectRatio: 3 / 2,
        backgroundColor: colors.surface,
    },
    tapToChange: {
        textAlign: 'center',
        color: colors.textSecondary,
        fontSize: 14,
        marginTop: 8,
    },
    photoPlaceholder: {
        width: '100%',
        aspectRatio: 3 / 2,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    photoButtons: {
        flexDirection: 'row',
        gap: 48,
    },
    photoButton: {
        alignItems: 'center',
        gap: 8,
    },
    photoButtonText: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '500',
    },
    mealInfoCard: {
        backgroundColor: colors.white,
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    mealTypeLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 4,
    },
    mealNameLarge: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 8,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    timeText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    loggedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    loggedBadgeText: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    notesCard: {
        backgroundColor: colors.white,
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 12,
    },
    notesText: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    feedbackCard: {
        backgroundColor: colors.white,
        marginHorizontal: 16,
        marginBottom: 24,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    feedbackHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    feedbackContent: {
        backgroundColor: colors.surface,
        padding: 12,
        borderRadius: 8,
    },
    dietitianInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    dietitianAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dietitianName: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    feedbackText: {
        fontSize: 14,
        color: colors.text,
        lineHeight: 20,
    },
    feedbackTime: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 8,
    },
    noFeedback: {
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    noFeedbackText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    mealTypeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    mealTypeButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.white,
    },
    mealTypeButtonSelected: {
        borderWidth: 2,
        borderColor: colors.primary,
    },
    mealTypeText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
    },
    mealTypeTextSelected: {
        fontWeight: '600',
    },
    timeContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
        marginBottom: 8,
    },
    timeDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.surface,
        padding: 16,
        borderRadius: 8,
    },
    scheduledTimeText: {
        fontSize: 16,
        color: colors.textSecondary,
    },
    notesContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    notesInput: {
        backgroundColor: colors.white,
        borderRadius: 8,
        padding: 16,
        fontSize: 16,
        color: colors.text,
        minHeight: 100,
        borderWidth: 1,
        borderColor: colors.border,
    },
    footer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingBottom: 24,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    submitButton: {
        backgroundColor: colors.primary,
        height: 52,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
});
