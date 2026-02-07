import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, TrendingUp, Bell, User } from 'lucide-react-native';
import { Colors, Spacing, FontSizes, FontWeights } from '../constants/theme';

interface TabItemProps {
    title: string;
    icon: React.ComponentType<{ size: number; color: string }>;
    isActive: boolean;
    onPress: () => void;
}

function TabItem({ title, icon: Icon, isActive, onPress }: TabItemProps) {
    const color = isActive ? Colors.tabActive : Colors.tabInactive;

    return (
        <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
            <Icon size={24} color={color} />
            <Text style={[styles.tabLabel, { color }]}>{title}</Text>
            {isActive && <View style={styles.activeIndicator} />}
        </TouchableOpacity>
    );
}

const tabs = [
    { name: 'home', title: 'Home', icon: Home, path: '/(tabs)/home' },
    { name: 'progress', title: 'Progress', icon: TrendingUp, path: '/(tabs)/progress' },
    { name: 'notifications', title: 'Inbox', icon: Bell, path: '/(tabs)/notifications' },
    { name: 'profile', title: 'Profile', icon: User, path: '/(tabs)/profile' },
];

export function BottomTabBar() {
    const router = useRouter();
    const pathname = usePathname();

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
});
