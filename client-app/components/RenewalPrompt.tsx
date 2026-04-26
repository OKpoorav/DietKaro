import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { AlertCircle, ExternalLink, X } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../constants/theme';
import { useToast } from './Toast';
import { useSubscription, type SubscriptionState } from '../hooks/useSubscription';
import api from '../services/api';
import { normalizeError } from '../utils/errorHandler';

/**
 * Module-level flag — keeps the popup dismissed for the rest of the app
 * session after the user closes it once. Reset on full app reload.
 */
let popupDismissedThisSession = false;

interface RenewalPromptProps {
    /** Show the one-time-per-session popup. Default true on home screen, false elsewhere. */
    showPopup?: boolean;
}

function shouldShowBanner(sub: SubscriptionState | null): boolean {
    if (!sub) return false;
    return sub.status === 'active' && sub.paymentStatus === 'unpaid';
}

export function RenewalPrompt({ showPopup = false }: RenewalPromptProps) {
    const router = useRouter();
    const toast = useToast();
    const { subscription, refresh } = useSubscription();
    const [paying, setPaying] = useState(false);
    const [popupOpen, setPopupOpen] = useState(false);

    const visible = shouldShowBanner(subscription);

    // Auto-open popup once per session when subscription is in grace.
    useEffect(() => {
        if (!showPopup) return;
        if (!subscription) return;
        if (popupDismissedThisSession) return;
        if (subscription.inGrace) {
            setPopupOpen(true);
        }
    }, [showPopup, subscription]);

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
            await refresh();
        } catch (err) {
            const e = normalizeError(err);
            toast.showToast({ title: 'Payment failed', message: e.message, variant: 'error' });
        } finally {
            setPaying(false);
            setPopupOpen(false);
        }
    };

    const dismissPopup = () => {
        popupDismissedThisSession = true;
        setPopupOpen(false);
    };

    if (!visible) return null;

    const cost = Number(subscription!.plan.costInr);
    const daysOverdue = -subscription!.daysUntilRenewal;
    const subtitle = subscription!.inGrace
        ? `${subscription!.graceDaysRemaining} day${subscription!.graceDaysRemaining === 1 ? '' : 's'} of grace remaining before your plan auto-pauses.`
        : daysOverdue > 0
            ? `Renewal was due ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} ago.`
            : 'Renewal payment is due today.';

    return (
        <>
            {/* Persistent banner — sits at the top of the host screen */}
            <View style={styles.banner}>
                <View style={styles.bannerLeft}>
                    <AlertCircle size={18} color="#92400E" />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.bannerTitle}>Renewal due — ₹{cost.toFixed(2)}</Text>
                        <Text style={styles.bannerSub}>{subtitle}</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.bannerCta} onPress={handlePayNow} disabled={paying}>
                    {paying ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.bannerCtaText}>Pay now</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* One-time-per-session popup */}
            <Modal visible={popupOpen} transparent animationType="fade" onRequestClose={dismissPopup}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <TouchableOpacity onPress={dismissPopup} style={styles.modalClose} hitSlop={12}>
                            <X size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                        <View style={styles.modalIcon}>
                            <AlertCircle size={28} color="#D97706" />
                        </View>
                        <Text style={styles.modalTitle}>Plan renewal due</Text>
                        <Text style={styles.modalBody}>
                            Your {subscription!.plan.name} plan needs a renewal payment of ₹{cost.toFixed(2)}.{' '}
                            {subscription!.inGrace && subscription!.graceDaysRemaining > 0
                                ? `You have ${subscription!.graceDaysRemaining} day${subscription!.graceDaysRemaining === 1 ? '' : 's'} before access pauses.`
                                : 'Pay now to keep your plan running.'}
                        </Text>

                        <TouchableOpacity style={styles.modalPrimary} onPress={handlePayNow} disabled={paying}>
                            {paying ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <ExternalLink size={18} color="#fff" />
                                    <Text style={styles.modalPrimaryText}>Pay ₹{cost.toFixed(2)}</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.modalSecondary}
                            onPress={() => {
                                dismissPopup();
                                router.push('/(tabs)/profile/subscription' as never);
                            }}
                        >
                            <Text style={styles.modalSecondaryText}>View details</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalGhost} onPress={dismissPopup}>
                            <Text style={styles.modalGhostText}>Remind me later</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: '#FEF3C7',
        borderColor: '#FDE68A',
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        padding: Spacing.sm,
        marginHorizontal: Spacing.md,
        marginTop: Spacing.sm,
    },
    bannerLeft: { flex: 1, flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    bannerTitle: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold, color: '#78350F' },
    bannerSub: { fontSize: FontSizes.xs, color: '#92400E', marginTop: 2 },
    bannerCta: {
        backgroundColor: '#D97706',
        borderRadius: BorderRadius.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    bannerCtaText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: FontWeights.bold },

    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
    },
    modalCard: {
        width: '100%',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        alignItems: 'center',
    },
    modalClose: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, padding: Spacing.xs },
    modalIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    modalTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text, textAlign: 'center' },
    modalBody: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginTop: Spacing.xs,
        marginBottom: Spacing.md,
    },
    modalPrimary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
        paddingVertical: 12,
        paddingHorizontal: Spacing.md,
        alignSelf: 'stretch',
    },
    modalPrimaryText: { color: '#fff', fontSize: FontSizes.md, fontWeight: FontWeights.bold },
    modalSecondary: {
        marginTop: Spacing.sm,
        paddingVertical: 10,
        alignSelf: 'stretch',
        alignItems: 'center',
    },
    modalSecondaryText: { color: Colors.primary, fontSize: FontSizes.sm, fontWeight: FontWeights.semibold },
    modalGhost: { marginTop: 4, paddingVertical: 8, alignSelf: 'stretch', alignItems: 'center' },
    modalGhostText: { color: Colors.textSecondary, fontSize: FontSizes.sm },
});
