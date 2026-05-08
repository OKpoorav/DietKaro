import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';
import { onboardingApi } from '../../services/api';

type PhotoType = 'front' | 'side' | 'back';

interface PhotoSlot {
    type: PhotoType;
    label: string;
    uri: string | null;
    uploading: boolean;
    uploaded: boolean;
}

export default function BeforePhotosScreen() {
    const router = useRouter();
    const [photos, setPhotos] = useState<PhotoSlot[]>([
        { type: 'front', label: 'Front Pic', uri: null, uploading: false, uploaded: false },
        { type: 'side', label: 'Side Pic', uri: null, uploading: false, uploaded: false },
        { type: 'back', label: 'Back Pic', uri: null, uploading: false, uploaded: false },
    ]);

    const updateSlot = (type: PhotoType, patch: Partial<PhotoSlot>) =>
        setPhotos((prev) => prev.map((p) => (p.type === type ? { ...p, ...patch } : p)));

    const pickPhoto = async (type: PhotoType) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow access to your photo library.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: true,
            aspect: [3, 4],
        });

        if (result.canceled || !result.assets?.[0]) return;

        const asset = result.assets[0];
        updateSlot(type, { uri: asset.uri, uploading: true, uploaded: false });

        try {
            const fd = new FormData();
            fd.append('photo', {
                uri: asset.uri,
                type: asset.mimeType ?? 'image/jpeg',
                name: `${type}.jpg`,
            } as any);
            await onboardingApi.uploadBeforePhoto(type, fd);
            updateSlot(type, { uploading: false, uploaded: true });
        } catch {
            updateSlot(type, { uri: null, uploading: false, uploaded: false });
            Alert.alert('Upload failed', 'Could not upload photo. Please try again.');
        }
    };

    const handleContinue = () => router.replace('/(onboarding)/complete');

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.headerIcon}>
                <Camera size={32} color={Colors.primaryDark} />
            </View>
            <Text style={styles.title}>Before Photos</Text>
            <Text style={styles.subtitle}>
                Optional — helps your dietitian track your visual progress over time. All three angles are useful.
            </Text>

            <View style={styles.grid}>
                {photos.map((slot) => (
                    <TouchableOpacity
                        key={slot.type}
                        style={[styles.photoSlot, slot.uploaded && styles.photoSlotDone]}
                        onPress={() => !slot.uploading && pickPhoto(slot.type)}
                        activeOpacity={0.7}
                    >
                        {slot.uploading ? (
                            <ActivityIndicator color={Colors.primaryDark} />
                        ) : slot.uri ? (
                            <Image source={{ uri: slot.uri }} style={styles.photoPreview} />
                        ) : (
                            <View style={styles.placeholder}>
                                <Text style={styles.plusIcon}>+</Text>
                            </View>
                        )}
                        <Text style={[styles.photoLabel, slot.uploaded && styles.photoLabelDone]}>
                            {slot.uploaded ? '✓ ' : ''}{slot.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity style={styles.button} onPress={handleContinue}>
                <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipButton} onPress={handleContinue}>
                <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.surface },
    content: { padding: Spacing.xxl },
    headerIcon: { marginBottom: Spacing.lg },
    title: { fontSize: 24, fontWeight: FontWeights.bold, color: Colors.text, marginBottom: Spacing.sm },
    subtitle: { fontSize: FontSizes.lg, color: Colors.textMuted, marginBottom: Spacing.xxxl, lineHeight: 22 },
    grid: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
    photoSlot: {
        flex: 1,
        aspectRatio: 0.75,
        borderRadius: BorderRadius.md,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: Colors.background,
    },
    photoSlotDone: { borderColor: Colors.primaryDark, borderStyle: 'solid' },
    placeholder: { alignItems: 'center', justifyContent: 'center', flex: 1, width: '100%' },
    plusIcon: { fontSize: 32, color: Colors.border },
    photoPreview: { width: '100%', height: '100%' },
    photoLabel: { fontSize: FontSizes.sm, color: Colors.textMuted, marginTop: Spacing.sm, fontWeight: FontWeights.medium },
    photoLabelDone: { color: Colors.primaryDark },
    button: {
        backgroundColor: Colors.primaryDark,
        padding: Spacing.xl,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        marginTop: Spacing.xl,
        shadowColor: Colors.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: { color: Colors.surface, fontSize: FontSizes.lg, fontWeight: FontWeights.semibold },
    skipButton: { padding: Spacing.xl, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.md },
    skipButtonText: { color: Colors.textMuted, fontSize: FontSizes.lg, fontWeight: FontWeights.medium },
});
