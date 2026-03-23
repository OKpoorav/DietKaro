import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Settings, MessageCircle, Utensils, Scale, Award, Bell } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../../constants/theme';
import { useNotifications } from '../../../hooks/useNotifications';
import { Notification } from '../../../types';

const getNotificationIcon = (notification: Notification) => {
    const key = notification.category || notification.type;
    switch (key) {
        case 'chat_message':
        case 'feedback':
            return MessageCircle;
        case 'meal_reminder':
        case 'reminder':
            return Utensils;
        case 'meal_review':
            return Utensils;
        case 'diet_plan':
        case 'plan_expiry':
            return Bell;
        case 'milestone':
        case 'weight':
        case 'achievement':
            return Scale;
        case 'compliance_alert':
            return Award;
        case 'report_processed':
            return Bell;
        default:
            return MessageCircle;
    }
};

function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

export default function NotificationsScreen() {
    const router = useRouter();
    const { notifications, isLoading, refetch, markAsRead } = useNotifications();

    const handleNotificationPress = useCallback((notification: Notification) => {
        if (!notification.isRead) {
            markAsRead(notification.id);
        }
        // Navigate to deepLink if the notification includes one
        const deepLink = notification.deepLink;
        if (deepLink) {
            router.push(deepLink as any);
        }
    }, [markAsRead, router]);

    const renderNotification = ({ item }: { item: Notification }) => {
        const IconComponent = getNotificationIcon(item);
        return (
            <TouchableOpacity
                style={[
                    styles.notificationItem,
                    !item.isRead && styles.notificationUnread,
                ]}
                activeOpacity={0.7}
                onPress={() => handleNotificationPress(item)}
            >
                <View style={styles.notificationIcon}>
                    <IconComponent size={20} color={Colors.primary} />
                </View>
                <View style={styles.notificationContent}>
                    <Text
                        style={[
                            styles.notificationTitle,
                            !item.isRead && styles.notificationTitleUnread,
                        ]}
                        numberOfLines={2}
                    >
                        {item.title}
                    </Text>
                    {item.message && (
                        <Text style={styles.notificationMessage} numberOfLines={1}>
                            {item.message}
                        </Text>
                    )}
                    <Text style={styles.notificationTime}>
                        {formatTimestamp(item.createdAt)}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerSpacer} />
                <Text style={styles.headerTitle}>Inbox</Text>
                <TouchableOpacity style={styles.settingsButton}>
                    <Settings size={24} color={Colors.text} />
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id}
                    renderItem={renderNotification}
                    contentContainerStyle={
                        notifications.length === 0 ? styles.emptyListContent : styles.notificationsList
                    }
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={false}
                            onRefresh={refetch}
                            tintColor={Colors.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MessageCircle size={48} color={Colors.textSecondary} />
                            <Text style={styles.emptyTitle}>No notifications yet</Text>
                            <Text style={styles.emptySubtitle}>
                                You'll see updates from your dietitian here
                            </Text>
                        </View>
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
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    headerSpacer: {
        width: 48,
    },
    headerTitle: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
    },
    settingsButton: {
        width: 48,
        height: 48,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notificationsList: {
        padding: Spacing.lg,
    },
    emptyListContent: {
        flexGrow: 1,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        paddingHorizontal: Spacing.xxl,
    },
    emptyTitle: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.text,
        marginTop: Spacing.lg,
    },
    emptySubtitle: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },
    notificationItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    notificationUnread: {
        backgroundColor: Colors.surfaceSecondary,
        borderColor: Colors.primary,
    },
    notificationIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.surfaceSecondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    notificationContent: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.medium,
        color: Colors.text,
        marginBottom: Spacing.xs,
    },
    notificationTitleUnread: {
        fontWeight: FontWeights.bold,
    },
    notificationMessage: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
    },
    notificationTime: {
        fontSize: FontSizes.xs,
        color: Colors.textSecondary,
    },
});
