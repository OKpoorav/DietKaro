'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useValidateInvite, useAcceptInvite } from '@/lib/hooks/use-team';
import { useUser, useClerk, SignInButton } from '@clerk/nextjs';
import { Loader2, AlertCircle, Building2, LogOut } from 'lucide-react';
import { toast } from 'sonner';

function JoinContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();

    // Data Fetching
    const { data: invite, isLoading, error } = useValidateInvite(token || '');
    const acceptMutation = useAcceptInvite();

    // Check if the logged-in user's email matches the invitation
    const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
    const inviteEmail = invite?.email?.toLowerCase();
    const emailMismatch = user && invite && userEmail !== inviteEmail;

    const handleJoin = async () => {
        if (!token) return;
        try {
            await acceptMutation.mutateAsync(token);
            toast.success('Successfully joined the team!');
            router.push('/dashboard');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to join team';
            toast.error(message);
        }
    };

    const handleSignOutAndSwitch = async () => {
        await signOut();
        // After sign-out, page will re-render showing the sign-in button
    };

    if (!token) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h2 className="text-xl font-bold text-gray-900">Invalid Link</h2>
                <p className="text-gray-500 mt-2">This invitation link is missing a token.</p>
            </div>
        );
    }

    if (isLoading || !isLoaded) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-brand mb-4" />
                <p className="text-gray-500">Verifying invitation...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h2 className="text-xl font-bold text-gray-900">Invitation Expired or Invalid</h2>
                <p className="text-gray-500 mt-2">This link may have already been used or has expired.</p>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-2xl shadow-xl border border-gray-100">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-brand" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Join Team</h1>
                <p className="text-gray-500 mt-2">
                    You have been invited to join <strong>{invite?.orgName}</strong> as a <strong>{invite?.role}</strong>.
                </p>
            </div>

            <div className="space-y-6">
                {!user ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-amber-50 rounded-lg text-amber-800 text-sm border border-amber-200">
                            Sign in with <strong>{invite?.email}</strong> to accept this invitation.
                        </div>
                        <SignInButton mode="modal" forceRedirectUrl={`/join?token=${token}`}>
                            <button className="w-full py-3 px-4 bg-brand hover:bg-brand/90 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-500/20">
                                Sign In / Sign Up to Join
                            </button>
                        </SignInButton>
                    </div>
                ) : emailMismatch ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                                {user.firstName?.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {user.fullName || user.username}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                    {user.primaryEmailAddress?.emailAddress}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 bg-red-50 rounded-lg text-red-800 text-sm border border-red-200">
                            This invitation was sent to <strong>{invite?.email}</strong>. You are currently signed in as <strong>{userEmail}</strong>. Please switch to the correct account.
                        </div>

                        <button
                            onClick={handleSignOutAndSwitch}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-all"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out &amp; Switch Account
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                                {user.firstName?.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    Logged in as {user.fullName || user.username}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                    {user.primaryEmailAddress?.emailAddress}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleJoin}
                            disabled={acceptMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-brand hover:bg-brand/90 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-500/20 disabled:opacity-50"
                        >
                            {acceptMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Join Organization
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function JoinPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <JoinContent />
        </Suspense>
    );
}
