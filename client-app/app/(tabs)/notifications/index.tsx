import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Settings, MessageCircle, Utensils, Scale, Award } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../../constants/theme';

// Mock notification data - will be replaced with API integration
const mockNotifications = [
    {
        id: '1',
        type: 'feedback',
        title: 'Dr. Sharma commented on your lunch',
        message: 'Great portion control! Keep it up.',
        timestamp: '2h ago',
        read: false,
    },
    {
        id: '2',
        type: 'reminder',
        title: "Don't forget to log your dinner",
        message: 'You have a meal scheduled for 7:30 PM',
        timestamp: '4h ago',
        read: false,
    },
    {
        id: '3',
        type: 'weight',
        title: 'Weekly weight check-in',
        message: "It's time to log your weight!",
        timestamp: '1d ago',
        read: true,
    },
    {
        id: '4',
        type: 'achievement',
        title: 'New milestone achieved! 🎉',
        message: "You've completed 7 days streak",
        timestamp: '2d ago',
        read: true,
    },
    {
        id: '5',
        type: 'feedback',
        title: 'Dr. Sharma approved your meal plan',
        message: 'Your breakfast choices look perfect',
        timestamp: '3d ago',
        read: true,
    },
];

const getNotificationIcon = (type: string) => {
    switch (type) {
        case 'feedback':
            return MessageCircle;
        case 'reminder':
            return Utensils;
        case 'weight':
            return Scale;
        case 'achievement':
            return Award;
        default:
            return MessageCircle;
    }
};

export default function NotificationsScreen() {
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);
    const [notifications] = useState(mockNotifications);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        // TODO: Refetch notifications from API
        await new Promise(resolve => setTimeout(resolve, 1000));
        setRefreshing(false);
    }, []);

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

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                    />
                }
            >
                {notifications.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <MessageCircle size={48} color={Colors.textSecondary} />
                        <Text style={styles.emptyTitle}>No notifications yet</Text>
                        <Text style={styles.emptySubtitle}>
                            You'll see updates from your dietitian here
                        </Text>
                    </View>
                ) : (
                    <View style={styles.notificationsList}>
                        {notifications.map((notification) => {
                            const IconComponent = getNotificationIcon(notification.type);
                            return (
                                <TouchableOpacity
                                    key={notification.id}
                                    style={[
                                        styles.notificationItem,
                                        !notification.read && styles.notificationUnread,
                                    ]}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.notificationIcon}>
                                        <IconComponent size={20} color={Colors.primary} />
                                    </View>
                                    <View style={styles.notificationContent}>
                                        <Text
                                            style={[
                                                styles.notificationTitle,
                                                !notification.read && styles.notificationTitleUnread,
                                            ]}
                                            numberOfLines={2}
                                        >
                                            {notification.title}
                                        </Text>
                                        {notification.message && (
                                            <Text style={styles.notificationMessage} numberOfLines={1}>
                                                {notification.message}
                                            </Text>
                                        )}
                                        <Text style={styles.notificationTime}>
                                            {notification.timestamp}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
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
    scrollView: {
        flex: 1,
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
    notificationsList: {
        padding: Spacing.lg,
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
