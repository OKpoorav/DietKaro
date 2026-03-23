import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, TrendingUp, Bell, User, MessageCircle } from 'lucide-react-native';
import { Colors, Spacing, FontSizes, FontWeights } from '../constants/theme';
import { useUnreadNotificationCount } from '../hooks/useNotifications';

interface TabItemProps {
    title: string;
    icon: React.ComponentType<{ size: number; color: string }>;
    isActive: boolean;
    onPress: () => void;
    badge?: number;
}

function TabItem({ title, icon: Icon, isActive, onPress, badge }: TabItemProps) {
    const color = isActive ? Colors.tabActive : Colors.tabInactive;

    return (
        <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
            <View>
                <Icon size={24} color={color} />
                {badge != null && badge > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                            {badge > 99 ? '99+' : badge}
                        </Text>
                    </View>
                )}
            </View>
            <Text style={[styles.tabLabel, { color }]}>{title}</Text>
            {isActive && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
    );
}

const tabs = [
    { name: 'home', title: 'Home', icon: Home, path: '/(tabs)/home' },
    { name: 'progress', title: 'Progress', icon: TrendingUp, path: '/(tabs)/progress' },
    { name: 'chat', title: 'Chat', icon: MessageCircle, path: '/(tabs)/chat' },
    { name: 'notifications', title: 'Inbox', icon: Bell, path: '/(tabs)/notifications' },
    { name: 'profile', title: 'Profile', icon: User, path: '/(tabs)/profile' },
];

export function BottomTabBar() {
    const router = useRouter();
    const pathname = usePathname();
    const unreadNotifications = useUnreadNotificationCount();

    const getActiveTab = () => {
        for (const tab of tabs) {
            if (pathname.includes(tab.name)) {
                return tab.name;
            }
        }
        return 'home';
    };

    const activeTab = getActiveTab();

    return (
        <View style={styles.container}>
            {tabs.map((tab) => (
                <TabItem
                    key={tab.name}
                    title={tab.title}
                    icon={tab.icon}
                    isActive={activeTab === tab.name}
                    onPress={() => router.push(tab.path as any)}
                    badge={tab.name === 'notifications' ? unreadNotifications : undefined}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: Colors.tabBackground,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingTop: Spacing.sm,
        paddingBottom: 28,
        paddingHorizontal: Spacing.sm,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.sm,
        position: 'relative',
    },
    tabLabel: {
        fontSize: FontSizes.xs,
        fontWeight: FontWeights.medium,
        marginTop: Spacing.xs,
    },
    activeIndicator: {
        position: 'absolute',
        bottom: -4,
        width: 20,
        height: 3,
        backgroundColor: Colors.primary,
        borderRadius: 2,
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -10,
        backgroundColor: '#EF4444',
        borderRadius: 9,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700' as const,
    },
});
