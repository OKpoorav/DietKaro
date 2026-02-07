import { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Share,
    ActivityIndicator,
    Linking,
    Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Copy, Share2, Gift, Users, Award } from 'lucide-react-native';
import api from '../../../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../../constants/theme';
import { useToast } from '../../../components/Toast';
import { normalizeError } from '../../../utils/errorHandler';
import { ReferralData, ReferralStats } from '../../../types';

export default function ReferralScreen() {
    const router = useRouter();
    const toast = useToast();
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
            const normalized = normalizeError(error);
            toast.showToast({ title: 'Error', message: normalized.message, variant: 'error' });
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
                toast.showToast({ title: 'Error', message: 'WhatsApp is not installed', variant: 'error' });
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
                    <ActivityIndicator size="large" color={Colors.primary} />
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
                        <ArrowLeft size={24} color={Colors.text} />
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
                            <Copy size={20} color={copied ? Colors.primary : Colors.text} />
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
                            <Share2 size={20} color={Colors.text} />
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
                                <Users size={20} color={Colors.primary} />
                            </View>
                            <Text style={styles.statValue}>{stats?.referralCount || 0}</Text>
                            <Text style={styles.statLabel}>Friends Invited</Text>
                        </View>
                        <View style={styles.statItem}>
                            <View style={styles.statIconContainer}>
                                <Award size={20} color={Colors.primary} />
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
        backgroundColor: Colors.background,
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
        color: Colors.text,
    },
    heroCard: {
        backgroundColor: Colors.primary,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        marginBottom: 16,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.text,
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
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    codeLabel: {
        fontSize: 14,
        color: Colors.textSecondary,
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
        color: Colors.text,
        letterSpacing: 4,
    },
    copyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Colors.surfaceSecondary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    copyText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
    },
    copyTextActive: {
        color: Colors.primary,
    },
    shareSection: {
        marginBottom: 16,
    },
    shareSectionTitle: {
        fontSize: 14,
        color: Colors.textSecondary,
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
        backgroundColor: Colors.surface,
        paddingVertical: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    shareButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    statsCard: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    statsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
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
        backgroundColor: Colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 28,
        fontWeight: '700',
        color: Colors.text,
    },
    statLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 4,
    },
    progressSection: {
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    progressText: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: 12,
    },
    progressBar: {
        height: 8,
        backgroundColor: Colors.surfaceSecondary,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 4,
    },
    recentCard: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    recentTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 16,
    },
    recentItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    recentName: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.text,
    },
    recentDate: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
});
