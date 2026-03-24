import { useProfile } from './use-profile';

export function usePermissions() {
    const { data: profile } = useProfile();
    const role = profile?.role;

    return {
        role,
        isOwner: role === 'owner',
        isAdmin: role === 'admin',
        isDietitian: role === 'dietitian',

        // Navigation permissions
        canViewTeam: role === 'owner' || role === 'admin',
        canViewAnalytics: role === 'owner' || role === 'admin',
        canViewReferrals: role === 'owner' || role === 'admin',

        // Action permissions
        canInviteTeam: role === 'owner' || role === 'admin',
        canInviteAdmin: role === 'owner',
        canDeleteClient: role === 'owner' || role === 'admin',
        canManageInvoices: role === 'owner' || role === 'admin',
        canClearValidationCache: role === 'owner' || role === 'admin',
        canRemoveMember: role === 'owner' || role === 'admin',
    };
}
