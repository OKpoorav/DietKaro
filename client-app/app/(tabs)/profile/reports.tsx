import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    FlatList,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, FileText, Upload, Trash2, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import api from '../../../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../../constants/theme';
import { useToast } from '../../../components/Toast';
import { normalizeError } from '../../../utils/errorHandler';
import { Report } from '../../../types';

export default function ReportsScreen() {
    const router = useRouter();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<Report[]>([]);
    const [uploading, setUploading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const response = await api.get('/client/reports');
            setReports(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleUpload = () => {
        Alert.alert(
            'Upload Report',
            'Choose how to upload your report',
            [
                {
                    text: 'Take Photo',
                    onPress: handleTakePhoto,
                },
                {
                    text: 'Choose from Gallery',
                    onPress: handlePickImage,
                },
                {
                    text: 'Select PDF',
                    onPress: handlePickDocument,
                },
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
            ]
        );
    };

    const handleTakePhoto = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            toast.showToast({ title: 'Permission Required', message: 'Camera access is needed to take photos', variant: 'warning' });
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: 'images',
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            uploadFile(result.assets[0].uri, 'photo.jpg', 'image/jpeg');
        }
    };

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            const uri = result.assets[0].uri;
            const fileName = uri.split('/').pop() || 'image.jpg';
            uploadFile(uri, fileName, 'image/jpeg');
        }
    };

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
            });

            if (!result.canceled && result.assets[0]) {
                const { uri, name, mimeType } = result.assets[0];
                uploadFile(uri, name, mimeType || 'application/pdf');
            }
        } catch (error) {
            toast.showToast({ title: 'Error', message: 'Failed to pick document', variant: 'error' });
        }
    };

    const uploadFile = async (uri: string, fileName: string, fileType: string) => {
        setUploading(true);
        try {
            // Get presigned URL
            const urlResponse = await api.post('/client/reports/upload-url', {
                fileName,
                fileType,
                reportType: 'other',
            });

            const { uploadUrl, key } = urlResponse.data.data;

            // Upload to S3
            const fileResponse = await fetch(uri);
            const blob = await fileResponse.blob();

            await fetch(uploadUrl, {
                method: 'PUT',
                body: blob,
                headers: {
                    'Content-Type': fileType,
                },
            });

            // Save report metadata
            await api.post('/client/reports', {
                key,
                fileName,
                fileType,
                reportType: 'other',
            });

            toast.showToast({ title: 'Success', message: 'Report uploaded successfully!', variant: 'success' });
            fetchReports();
        } catch (error) {
            console.error('Upload error:', error);
            const normalized = normalizeError(error);
            toast.showToast({ title: 'Upload Failed', message: normalized.message, variant: 'error' });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = (report: Report) => {
        Alert.alert(
            'Delete Report',
            `Are you sure you want to delete "${report.fileName}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`/client/reports/${report.id}`);
                            setReports(reports.filter(r => r.id !== report.id));
                        } catch (error) {
                            const normalized = normalizeError(error);
                            toast.showToast({ title: 'Error', message: normalized.message, variant: 'error' });
                        }
                    },
                },
            ]
        );
    };

    const renderReport = ({ item }: { item: Report }) => (
        <View style={styles.reportCard}>
            <View style={styles.reportIcon}>
                {item.fileType === 'pdf' ? (
                    <FileText size={24} color={Colors.primary} />
                ) : (
                    <ImageIcon size={24} color={Colors.primary} />
                )}
            </View>
            <View style={styles.reportInfo}>
                <Text style={styles.reportName} numberOfLines={1}>{item.fileName}</Text>
                <Text style={styles.reportMeta}>
                    {item.reportType} • {new Date(item.uploadedAt).toLocaleDateString()}
                </Text>
            </View>
            <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item)}
            >
                <Trash2 size={20} color={Colors.error} />
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Reports</Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={reports}
                    renderItem={renderReport}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => {
                                setRefreshing(true);
                                fetchReports();
                            }}
                            tintColor={Colors.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <FileText size={48} color={Colors.textSecondary} />
                            <Text style={styles.emptyTitle}>No Reports Yet</Text>
                            <Text style={styles.emptySubtitle}>
                                Upload your medical reports, blood tests, and other documents
                            </Text>
                        </View>
                    }
                    ListHeaderComponent={
                        <TouchableOpacity
                            style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                            onPress={handleUpload}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <ActivityIndicator color={Colors.text} />
                            ) : (
                                <>
                                    <Upload size={20} color={Colors.text} />
                                    <Text style={styles.uploadButtonText}>Upload Report</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    }
                />
            )}
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
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: Colors.text,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        paddingTop: 0,
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 14,
        marginBottom: 24,
    },
    uploadButtonDisabled: {
        opacity: 0.7,
    },
    uploadButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    reportCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    reportIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: Colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    reportInfo: {
        flex: 1,
    },
    reportName: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    reportMeta: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 4,
    },
    deleteButton: {
        padding: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.text,
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 32,
    },
});
