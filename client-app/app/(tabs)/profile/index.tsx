import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { ChevronRight, Bell, Shield, HelpCircle, LogOut, Users, FileText, CreditCard, Gift } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../../constants/theme';
import { useToast } from '../../../components/Toast';

interface MenuItemProps {
    icon: typeof Bell;
    title: string;
    subtitle?: string;
    onPress: () => void;
    showChevron?: boolean;
    danger?: boolean;
}

function MenuItem({ icon: Icon, title, subtitle, onPress, showChevron = true, danger = false }: MenuItemProps) {
    return (
        <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.menuIconContainer, danger && styles.menuIconDanger]}>
                <Icon size={20} color={danger ? Colors.error : Colors.primary} />
            </View>
            <View style={styles.menuTextContainer}>
                <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>{title}</Text>
                {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
            </View>
            {showChevron && <ChevronRight size={20} color={Colors.textSecondary} />}
        </TouchableOpacity>
    );
}

export default function ProfileScreen() {
    const router = useRouter();
    const { logout, client } = useAuth();
    const toast = useToast();

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                        router.replace('/(auth)/login');
                    }
                },
            ]
        );
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <Text style={styles.headerTitle}>Profile</Text>

                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.avatarContainer}>
                        {client?.profilePhotoUrl ? (
                            <Image source={{ uri: client.profilePhotoUrl }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarText}>
                                    {client?.fullName ? getInitials(client.fullName) : 'U'}
                                </Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>{client?.fullName || 'User'}</Text>
                        <Text style={styles.profilePhone}>{client?.phone || '+91 XXXXXXXXXX'}</Text>
                        {client?.email && (
                            <Text style={styles.profileEmail}>{client.email}</Text>
                        )}
                    </View>
                </View>

                {/* Subscription Card */}
                <View style={styles.subscriptionCard}>
                    <View style={styles.subscriptionHeader}>
                        <CreditCard size={20} color={Colors.primary} />
                        <Text style={styles.subscriptionTitle}>Subscription</Text>
                    </View>
                    <View style={styles.subscriptionDetails}>
                        <View style={styles.subscriptionRow}>
                            <Text style={styles.subscriptionLabel}>Status</Text>
                            <View style={styles.activeBadge}>
                                <Text style={styles.activeBadgeText}>Active</Text>
                            </View>
                        </View>
                        <View style={styles.subscriptionRow}>
                            <Text style={styles.subscriptionLabel}>Plan</Text>
                            <Text style={styles.subscriptionValue}>Monthly</Text>
                        </View>
                        <View style={styles.subscriptionRow}>
                            <Text style={styles.subscriptionLabel}>Renews</Text>
                            <Text style={styles.subscriptionValue}>-- / -- / ----</Text>
                        </View>
                    </View>
                </View>

                {/* Referral Card */}
                <TouchableOpacity
                    style={styles.referralCard}
                    onPress={() => router.push('/(tabs)/profile/referral')}
                    activeOpacity={0.8}
                >
                    <View style={styles.referralIconContainer}>
                        <Gift size={24} color="#fff" />
                    </View>
                    <View style={styles.referralContent}>
                        <Text style={styles.referralTitle}>Refer & Earn</Text>
                        <Text style={styles.referralSubtitle}>Get 1 month free for every 3 referrals!</Text>
                    </View>
                    <ChevronRight size={24} color={Colors.primary} />
                </TouchableOpacity>

                {/* Menu Items */}
                <View style={styles.menuSection}>
                    <MenuItem
                        icon={Bell}
                        title="Notifications"
                        onPress={() => router.push('/(tabs)/notifications')}
                    />
                    <MenuItem
                        icon={FileText}
                        title="My Reports"
                        subtitle="Upload & view medical reports"
                        onPress={() => router.push('/(tabs)/profile/reports')}
                    />
                    <MenuItem
                        icon={Shield}
                        title="Privacy & Security"
                        onPress={() => toast.showToast({ title: 'Coming Soon', message: 'This feature will be available soon.', variant: 'info' })}
                    />
                    <MenuItem
                        icon={HelpCircle}
                        title="Help & Support"
                        onPress={() => toast.showToast({ title: 'Help', message: 'Contact us at support@dietconnect.com', variant: 'info' })}
                    />
                </View>

                {/* Logout */}
                <View style={styles.logoutSection}>
                    <MenuItem
                        icon={LogOut}
                        title="Logout"
                        onPress={handleLogout}
                        showChevron={false}
                        danger
                    />
                </View>

                {/* Version */}
                <Text style={styles.versionText}>Version 1.0.0</Text>
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
        padding: 16,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 24,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    avatarContainer: {
        marginRight: 16,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
    },
    avatarPlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.text,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 4,
    },
    profilePhone: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    profileEmail: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    // Subscription Card
    subscriptionCard: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    subscriptionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    subscriptionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    subscriptionDetails: {
        gap: 8,
    },
    subscriptionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    subscriptionLabel: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    subscriptionValue: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.text,
    },
    activeBadge: {
        backgroundColor: '#d1fae5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    activeBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#065f46',
    },
    // Referral Card
    referralCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surfaceSecondary,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    referralIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    referralContent: {
        flex: 1,
    },
    referralTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text,
    },
    referralSubtitle: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    menuSection: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
        marginBottom: 16,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    menuIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    menuIconDanger: {
        backgroundColor: '#fee2e2',
    },
    menuTextContainer: {
        flex: 1,
    },
    menuTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: Colors.text,
    },
    menuSubtitle: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    menuTitleDanger: {
        color: Colors.error,
    },
    logoutSection: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
        marginBottom: 24,
    },
    versionText: {
        textAlign: 'center',
        fontSize: 12,
        color: Colors.textSecondary,
        marginBottom: 24,
    },
});
