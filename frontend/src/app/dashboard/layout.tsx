'use client';

import { UserButton, useUser, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    UtensilsCrossed,
    Apple,
    Camera,
    BarChart3,
    UsersRound,
    Settings,
    Menu,
    X,
    MessageSquare,
    CreditCard,
    UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { SocketProvider } from '@/lib/socket/socket-provider';
import { useUnreadCounts } from '@/lib/hooks/use-chat';
import { usePermissions } from '../../lib/hooks/use-permissions';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { useProfile } from '@/lib/hooks/use-profile';
import { useClerk } from '@clerk/nextjs';

type PermissionKey = 'canViewTeam' | 'canViewAnalytics' | 'canViewReferrals' | 'canViewSubscriptions' | 'canViewLeads';

const navigation: { name: string; href: string; icon: typeof LayoutDashboard; permission?: PermissionKey }[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Clients', href: '/dashboard/clients', icon: Users },
    { name: 'Leads', href: '/dashboard/leads', icon: UserPlus, permission: 'canViewLeads' },
    { name: 'Subscriptions', href: '/dashboard/subscriptions', icon: CreditCard, permission: 'canViewSubscriptions' },
    { name: 'Diet Plans', href: '/dashboard/diet-plans', icon: UtensilsCrossed },
    { name: 'Food Library', href: '/dashboard/food-library', icon: Apple },
    { name: 'Meal Reviews', href: '/dashboard/reviews', icon: Camera },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, permission: 'canViewAnalytics' },
    { name: 'Team', href: '/dashboard/team', icon: UsersRound, permission: 'canViewTeam' },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { user, isLoaded: isClerkLoaded } = useUser();
    const { signOut } = useClerk();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const permissions = usePermissions();
    const { error: profileError, isLoading: profileLoading } = useProfile();

    const filteredNavigation = useMemo(
        () => navigation.filter((item) => !item.permission || permissions[item.permission]),
        [permissions]
    );

    // If Clerk session exists but user has no DB record, show a setup screen
    const isNotRegistered = profileError && (profileError as any)?.response?.data?.error?.code === 'USER_NOT_REGISTERED';

    if (!isClerkLoaded || profileLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    if (isNotRegistered) {
        return <NotRegisteredScreen user={user} signOut={signOut} />;
    }

    return (
        <SocketProvider>
        <div className="min-h-screen bg-gray-50">
            {/* Mobile sidebar backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                                <UtensilsCrossed className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-bold text-gray-900">HealthPractix</span>
                        </Link>
                        <button
                            className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                        {filteredNavigation.map((item) => {
                            const isActive = item.href === '/dashboard'
                                ? pathname === '/dashboard'
                                : pathname === item.href || pathname.startsWith(item.href + '/');
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    )}
                                >
                                    <item.icon className={cn('w-5 h-5', isActive && 'text-emerald-600')} />
                                    {item.name}
                                </Link>
                            );
                        })}
                        <MessagesNavItem />
                    </nav>

                    {/* User section */}
                    <div className="border-t border-gray-200 p-4">
                        <div className="flex items-center gap-3">
                            <UserButton afterSignOutUrl="/" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {user?.fullName || 'Dietitian'}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                    {user?.primaryEmailAddress?.emailAddress}
                                </p>
                            </div>
                            <Link href="/dashboard/settings" className="p-2 text-gray-400 hover:text-gray-600">
                                <Settings className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="lg:pl-64">
                {/* Mobile top bar */}
                <header className="sticky top-0 z-30 bg-white border-b border-gray-200 lg:hidden">
                    <div className="flex items-center justify-between h-16 px-4">
                        <button
                            className="p-2 text-gray-500 hover:text-gray-700"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                                <UtensilsCrossed className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-lg font-bold text-gray-900">HealthPractix</span>
                        </Link>
                        <div className="flex items-center gap-2">
                            <NotificationDropdown />
                            <UserButton afterSignOutUrl="/" />
                        </div>
                    </div>
                </header>

                {/* Desktop top bar */}
                <header className="sticky top-0 z-30 bg-white border-b border-gray-200 hidden lg:block">
                    <div className="flex items-center justify-end h-14 px-6 gap-3">
                        <NotificationDropdown />
                        <UserButton afterSignOutUrl="/" />
                    </div>
                </header>

                {/* Page content */}
                <main className="p-6"><ErrorBoundary>{children}</ErrorBoundary></main>
            </div>
        </div>
        </SocketProvider>
    );
}

function NotRegisteredScreen({ user, signOut }: { user: any; signOut: (opts: any) => Promise<void> }) {
    const [showCreate, setShowCreate] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="max-w-md mx-auto p-8 bg-white rounded-2xl shadow-lg border border-gray-100 text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-amber-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to HealthPractix</h1>
                <p className="text-gray-500 mb-6">
                    {showCreate
                        ? 'Set up your practice to get started.'
                        : 'You can create a new practice or join an existing team via invitation.'
                    }
                </p>
                <p className="text-sm text-gray-400 mb-6">
                    Signed in as <strong>{user?.primaryEmailAddress?.emailAddress}</strong>
                </p>

                {!showCreate ? (
                    <div className="space-y-3">
                        <button
                            onClick={() => setShowCreate(true)}
                            className="w-full px-4 py-3 text-sm font-bold text-white bg-brand rounded-xl hover:bg-brand/90 transition-colors"
                        >
                            Create New Practice
                        </button>
                        <p className="text-xs text-gray-400">
                            Or wait for an invitation link from your team admin
                        </p>
                        <button
                            onClick={() => signOut({ redirectUrl: '/' })}
                            className="w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 mt-4"
                        >
                            Sign Out
                        </button>
                    </div>
                ) : (
                    <OrgCreationForm onBack={() => setShowCreate(false)} signOut={signOut} />
                )}
            </div>
        </div>
    );
}

function OrgCreationForm({ onBack, signOut }: { onBack: () => void; signOut: (opts: any) => Promise<void> }) {
    const [orgName, setOrgName] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const { getToken } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgName.trim()) return;
        setCreating(true);
        setError('');

        try {
            const token = await getToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/v1/organizations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ name: orgName.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'Failed to create organization');
            window.location.reload();
        } catch (err: any) {
            setError(err.message);
            setCreating(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Practice / Clinic Name</label>
                <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. NutriCare Clinic"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand focus:border-brand"
                    required
                    autoFocus
                />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
                type="submit"
                disabled={creating || !orgName.trim()}
                className="w-full px-4 py-3 text-sm font-bold text-white bg-brand rounded-xl hover:bg-brand/90 transition-colors disabled:opacity-50"
            >
                {creating ? 'Creating...' : 'Create Practice'}
            </button>
            <div className="flex gap-2">
                <button type="button" onClick={onBack} className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                    Back
                </button>
                <button type="button" onClick={() => signOut({ redirectUrl: '/' })} className="flex-1 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
                    Sign Out
                </button>
            </div>
        </form>
    );
}

function MessagesNavItem() {
    const pathname = usePathname();
    const isActive = pathname.startsWith('/dashboard/messages');
    const { data: unreadData } = useUnreadCounts();
    const total = unreadData?.total || 0;

    return (
        <Link
            href="/dashboard/messages"
            className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
        >
            <MessageSquare className={cn('w-5 h-5', isActive && 'text-emerald-600')} />
            Messages
            {total > 0 && (
                <span className="ml-auto min-w-[20px] h-5 rounded-full bg-brand text-white text-[11px] flex items-center justify-center font-bold px-1.5">
                    {total > 9 ? '9+' : total}
                </span>
            )}
        </Link>
    );
}
