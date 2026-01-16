import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, TrendingUp, Bell, User } from 'lucide-react-native';

// Figma Design Colors
const colors = {
    background: '#f8fcf9',
    primary: '#13ec5b',
    text: '#0d1b12',
    textSecondary: '#4c9a66',
    border: '#cfe7d7',
};

interface TabItemProps {
    title: string;
    icon: React.ComponentType<{ size: number; color: string }>;
    isActive: boolean;
    onPress: () => void;
}

function TabItem({ title, icon: Icon, isActive, onPress }: TabItemProps) {
    const color = isActive ? colors.text : colors.textSecondary;

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
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 8,
        paddingBottom: 28,
        paddingHorizontal: 8,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        position: 'relative',
    },
    tabLabel: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 4,
    },
    activeIndicator: {
        position: 'absolute',
        bottom: -4,
        width: 20,
        height: 3,
        backgroundColor: colors.primary,
        borderRadius: 2,
    },
});
