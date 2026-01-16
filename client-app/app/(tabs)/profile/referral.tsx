import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Share,
    Alert,
    ActivityIndicator,
    Linking,
    Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Copy, Share2, Gift, Users, Award } from 'lucide-react-native';
import api from '../../../services/api';

const colors = {
    background: '#f8fcf9',
    primary: '#13ec5b',
    text: '#0d1b12',
    textSecondary: '#4c9a66',
    border: '#cfe7d7',
    surface: '#e7f3eb',
    white: '#ffffff',
};

interface ReferralData {
    referralCode: string;
    shareMessage: string;
    whatsappLink: string;
}

interface ReferralStats {
    referralCount: number;
    freeMonthsEarned: number;
    freeMonthsUsed: number;
    freeMonthsRemaining: number;
    referralsUntilNextReward: number;
    referredClients: { name: string; joinedAt: string }[];
}

export default function ReferralScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [referralData, setReferralData] = useState<ReferralData | null>(null);
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchReferralData();
    }, []);

    const fetchReferralData = async () => {
        try {
            const [codeRes, statsRes] = await Promise.all([
                api.get('/client/referral/code'),
                api.get('/client/referral/stats'),
            ]);
            setReferralData(codeRes.data.data);
            setStats(statsRes.data.data);
        } catch (error) {
            Alert.alert('Error', 'Failed to load referral data');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyCode = async () => {
        if (referralData?.referralCode) {
            Clipboard.setString(referralData.referralCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleShareWhatsApp = async () => {
        if (referralData?.whatsappLink) {
            try {
                await Linking.openURL(referralData.whatsappLink);
            } catch (error) {
                Alert.alert('Error', 'WhatsApp is not installed');
            }
        }
    };

    const handleShare = async () => {
        if (referralData?.shareMessage) {
            try {
                await Share.share({
                    message: referralData.shareMessage,
                });
            } catch (error) {
                console.error('Share error:', error);
            }
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Refer & Earn</Text>
                </View>

                {/* Hero Card */}
                <View style={styles.heroCard}>
                    <Gift size={48} color="#fff" />
                    <Text style={styles.heroTitle}>Invite Friends, Get Rewards!</Text>
                    <Text style={styles.heroSubtitle}>
                        Share your code with friends. When 3 friends join, you get 1 month FREE!
                    </Text>
                </View>

                {/* Referral Code Card */}
                <View style={styles.codeCard}>
                    <Text style={styles.codeLabel}>Your Referral Code</Text>
                    <View style={styles.codeContainer}>
                        <Text style={styles.codeText}>{referralData?.referralCode || '------'}</Text>
                        <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
                            <Copy size={20} color={copied ? colors.primary : colors.text} />
                            <Text style={[styles.copyText, copied && styles.copyTextActive]}>
                                {copied ? 'Copied!' : 'Copy'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Share Buttons */}
                <View style={styles.shareSection}>
                    <Text style={styles.shareSectionTitle}>Share via</Text>
                    <View style={styles.shareButtons}>
                        <TouchableOpacity style={styles.whatsappButton} onPress={handleShareWhatsApp}>
                            <Text style={styles.whatsappIcon}>💬</Text>
                            <Text style={styles.shareButtonText}>WhatsApp</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                            <Share2 size={20} color={colors.text} />
                            <Text style={styles.shareButtonText}>More</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Stats Card */}
                <View style={styles.statsCard}>
                    <Text style={styles.statsTitle}>Your Referral Stats</Text>
                    <View style={styles.statsGrid}>
                        <View style={styles.statItem}>
                            <View style={styles.statIconContainer}>
                                <Users size={20} color={colors.primary} />
                            </View>
                            <Text style={styles.statValue}>{stats?.referralCount || 0}</Text>
                            <Text style={styles.statLabel}>Friends Invited</Text>
                        </View>
                        <View style={styles.statItem}>
                            <View style={styles.statIconContainer}>
                                <Award size={20} color={colors.primary} />
                            </View>
                            <Text style={styles.statValue}>{stats?.freeMonthsRemaining || 0}</Text>
                            <Text style={styles.statLabel}>Free Months</Text>
                        </View>
                    </View>

                    {/* Progress to next reward */}
                    <View style={styles.progressSection}>
                        <Text style={styles.progressText}>
                            {stats?.referralsUntilNextReward === 0
                                ? '🎉 You earned a free month!'
                                : `${stats?.referralsUntilNextReward || 3} more referrals to earn 1 free month`}
                        </Text>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        width: `${((3 - (stats?.referralsUntilNextReward || 3)) / 3) * 100}%`,
                                    },
                                ]}
                            />
                        </View>
                    </View>
                </View>

                {/* Recent Referrals */}
                {stats?.referredClients && stats.referredClients.length > 0 && (
                    <View style={styles.recentCard}>
                        <Text style={styles.recentTitle}>Recent Referrals</Text>
                        {stats.referredClients.map((client, index) => (
                            <View key={index} style={styles.recentItem}>
                                <Text style={styles.recentName}>{client.name}</Text>
                                <Text style={styles.recentDate}>
                                    {new Date(client.joinedAt).toLocaleDateString()}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
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
    },
    scrollView: {
        flex: 1,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.text,
    },
    heroCard: {
        backgroundColor: colors.primary,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        marginBottom: 16,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text,
        marginTop: 16,
        textAlign: 'center',
    },
    heroSubtitle: {
        fontSize: 14,
        color: 'rgba(13,27,18,0.8)',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },
    codeCard: {
        backgroundColor: colors.white,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    codeLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 12,
    },
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    codeText: {
        fontSize: 32,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: 4,
    },
    copyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    copyText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    copyTextActive: {
        color: colors.primary,
    },
    shareSection: {
        marginBottom: 16,
    },
    shareSectionTitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 12,
    },
    shareButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    whatsappButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#25D366',
        paddingVertical: 16,
        borderRadius: 14,
    },
    whatsappIcon: {
        fontSize: 20,
    },
    shareButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.white,
        paddingVertical: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
    },
    shareButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    statsCard: {
        backgroundColor: colors.white,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 16,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text,
    },
    statLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 4,
    },
    progressSection: {
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    progressText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 12,
    },
    progressBar: {
        height: 8,
        backgroundColor: colors.surface,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 4,
    },
    recentCard: {
        backgroundColor: colors.white,
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border,
    },
    recentTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 16,
    },
    recentItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    recentName: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
    },
    recentDate: {
        fontSize: 12,
        color: colors.textSecondary,
    },
});
