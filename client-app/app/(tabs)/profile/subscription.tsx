import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft, CalendarClock, CheckCircle2, CreditCard, ExternalLink } from 'lucide-react-native';
import api from '../../../services/api';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../../constants/theme';
import { useToast } from '../../../components/Toast';
import { normalizeError } from '../../../utils/errorHandler';

interface SubscriptionData {
    id: string;
    status: 'active' | 'paused' | 'deactivated';
    paymentStatus: 'paid' | 'unpaid';
    activeDate: string;
    renewalDate: string;
    pausedUntil: string | null;
    lastPaidAt: string | null;
    plan: {
        id: string;
        name: string;
        recurrenceUnit: string;
        intervalCount: number;
        durationDays: number;
        costInr: number | string;
    };
}

interface Payment {
    id: string;
    amountInr: number | string;
    status: 'pending' | 'succeeded' | 'failed' | 'expired';
    method: string;
    paidAt: string | null;
    createdAt: string;
}

const METHOD_LABELS: Record<string, string> = {
    razorpay_link: 'Razorpay link',
    razorpay_checkout: 'Razorpay',
    manual_cash: 'Cash',
    manual_upi: 'UPI',
    manual_bank: 'Bank transfer',
    manual_other: 'Other',
    mark_active: 'Granted by dietitian',
};

function formatDate(input: string | null | undefined): string {
    if (!input) return '—';
    return new Date(input).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SubscriptionScreen() {
    const router = useRouter();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [paying, setPaying] = useState(false);

    const fetchAll = useCallback(async () => {
        try {
            const [subRes, payRes] = await Promise.all([
                api.get('/client/subscription'),
                api.get('/client/subscription/payments'),
            ]);
            setSubscription(subRes.data.data ?? null);
            setPayments(payRes.data.data ?? []);
        } catch (err) {
            const e = normalizeError(err);
            toast.showToast({ title: 'Could not load subscription', message: e.message, variant: 'error' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchAll();
    };

    const handlePayNow = async () => {
        if (!subscription) return;
        setPaying(true);
        try {
            const res = await api.post('/client/subscription/link', {});
            const shortUrl = res.data.data?.shortUrl;
            if (!shortUrl) throw new Error('No payment URL returned');

            await WebBrowser.openBrowserAsync(shortUrl, {
                dismissButtonStyle: 'close',
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
            });
            // After dismiss — refetch to surface the latest payment status.
            await fetchAll();
        } catch (err) {
            const e = normalizeError(err);
            toast.showToast({ title: 'Payment failed', message: e.message, variant: 'error' });
        } finally {
            setPaying(false);
        }
    };

    const renderStatusPill = () => {
        if (!subscription) return null;
        if (subscription.status === 'paused') {
            return (
                <View style={[styles.pill, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.pillText, { color: '#92400E' }]}>Paused</Text>
                </View>
            );
        }
        if (subscription.status === 'deactivated') {
            return (
                <View style={[styles.pill, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={[styles.pillText, { color: '#991B1B' }]}>Deactivated</Text>
                </View>
            );
        }
        if (subscription.paymentStatus === 'paid') {
            return (
                <View style={[styles.pill, { backgroundColor: '#D1FAE5' }]}>
                    <Text style={[styles.pillText, { color: '#065F46' }]}>Paid</Text>
                </View>
            );
        }
        return (
            <View style={[styles.pill, { backgroundColor: '#FEF9C3' }]}>
                <Text style={[styles.pillText, { color: '#854D0E' }]}>Unpaid</Text>
            </View>
        );
    };

    const cost = subscription ? Number(subscription.plan.costInr) : 0;
    const showPayNow = subscription
        && subscription.status === 'active'
        && subscription.paymentStatus === 'unpaid';

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loaderWrap}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Subscription</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                {!subscription ? (
                    <View style={styles.emptyState}>
                        <CreditCard size={48} color={Colors.textSecondary} />
                        <Text style={styles.emptyTitle}>No active subscription</Text>
                        <Text style={styles.emptySubtitle}>
                            Your dietitian will assign a plan. You'll see it here once that happens.
                        </Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={styles.cardHeaderLeft}>
                                    <View style={styles.iconCircle}>
                                        <CreditCard size={20} color={Colors.primary} />
                                    </View>
                                    <View>
                                        <Text style={styles.planName}>{subscription.plan.name}</Text>
                                        <Text style={styles.planCost}>₹{cost.toFixed(2)}</Text>
                                    </View>
                                </View>
                                {renderStatusPill()}
                            </View>

                            <View style={styles.dateRow}>
                                <View style={styles.dateBlock}>
                                    <Text style={styles.dateLabel}>Active since</Text>
                                    <View style={styles.dateValueRow}>
                                        <CalendarClock size={14} color={Colors.textSecondary} />
                                        <Text style={styles.dateValue}>{formatDate(subscription.activeDate)}</Text>
                                    </View>
                                </View>
                                <View style={styles.dateBlock}>
                                    <Text style={styles.dateLabel}>Renews on</Text>
                                    <View style={styles.dateValueRow}>
                                        <CalendarClock size={14} color={Colors.textSecondary} />
                                        <Text style={styles.dateValue}>{formatDate(subscription.renewalDate)}</Text>
                                    </View>
                                </View>
                            </View>

                            {showPayNow && (
                                <TouchableOpacity
                                    style={[styles.payButton, paying && styles.payButtonDisabled]}
                                    onPress={handlePayNow}
                                    disabled={paying}
                                >
                                    {paying ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <ExternalLink size={18} color="#fff" />
                                            <Text style={styles.payButtonText}>Pay ₹{cost.toFixed(2)}</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}

                            {subscription.status === 'paused' && (
                                <Text style={styles.note}>
                                    Plan paused{subscription.pausedUntil ? ` until ${formatDate(subscription.pausedUntil)}` : ''}.
                                    Contact your dietitian to resume.
                                </Text>
                            )}
                            {subscription.status === 'deactivated' && (
                                <Text style={styles.note}>
                                    Plan ended. Reach out to your dietitian to start a new one.
                                </Text>
                            )}
                        </View>

                        <Text style={styles.sectionTitle}>Payment history</Text>
                        {payments.length === 0 ? (
                            <Text style={styles.emptyHistory}>No payments yet.</Text>
                        ) : (
                            <View style={styles.historyList}>
                                {payments.map((p) => (
                                    <View key={p.id} style={styles.historyRow}>
                                        <View style={styles.historyLeft}>
                                            {p.status === 'succeeded' ? (
                                                <CheckCircle2 size={18} color="#10b981" />
                                            ) : (
                                                <CreditCard size={18} color={Colors.textSecondary} />
                                            )}
                                            <View>
                                                <Text style={styles.historyAmount}>₹{Number(p.amountInr).toFixed(2)}</Text>
                                                <Text style={styles.historyMeta}>
                                                    {METHOD_LABELS[p.method] ?? p.method} · {formatDate(p.paidAt ?? p.createdAt)}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.historyStatus, p.status === 'succeeded' ? styles.historyOk : styles.historyMuted]}>
                                            {p.status}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.surface,
        gap: Spacing.sm,
    },
    backButton: { padding: Spacing.xs },
    headerTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text },
    scrollContent: { padding: Spacing.md, paddingBottom: Spacing.xl },
    emptyState: {
        alignItems: 'center',
        padding: Spacing.lg,
        marginTop: Spacing.lg,
    },
    emptyTitle: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.semibold,
        color: Colors.text,
        marginTop: Spacing.md,
    },
    emptySubtitle: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.xs,
        lineHeight: 20,
    },
    card: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
        flexShrink: 1,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.surfaceSecondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    planName: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text },
    planCost: { fontSize: FontSizes.sm, color: Colors.textSecondary },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    pillText: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold },
    dateRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
    dateBlock: { flex: 1, backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.sm },
    dateLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    dateValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    dateValue: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.text },
    payButton: {
        marginTop: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
        paddingVertical: 12,
    },
    payButtonDisabled: { opacity: 0.6 },
    payButtonText: { color: '#fff', fontSize: FontSizes.md, fontWeight: FontWeights.bold },
    note: {
        marginTop: Spacing.md,
        fontSize: FontSizes.xs,
        color: Colors.textSecondary,
        lineHeight: 18,
    },
    sectionTitle: {
        marginTop: Spacing.lg,
        marginBottom: Spacing.sm,
        fontSize: FontSizes.sm,
        fontWeight: FontWeights.semibold,
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    emptyHistory: { fontSize: FontSizes.sm, color: Colors.textSecondary, fontStyle: 'italic' },
    historyList: { gap: Spacing.xs },
    historyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.sm,
    },
    historyLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    historyAmount: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text },
    historyMeta: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2 },
    historyStatus: {
        fontSize: FontSizes.xs,
        fontWeight: FontWeights.semibold,
        textTransform: 'capitalize',
    },
    historyOk: { color: '#10b981' },
    historyMuted: { color: Colors.textSecondary },
});
