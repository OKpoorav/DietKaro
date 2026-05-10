'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, UtensilsCrossed, MessageSquare, MoreHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useUnreadCounts } from '@/lib/hooks/use-chat';

const PRIMARY_TABS = [
    { name: 'Home', href: '/dashboard', icon: LayoutDashboard, exact: true },
    { name: 'Clients', href: '/dashboard/clients', icon: Users },
    { name: 'Plans', href: '/dashboard/diet-plans', icon: UtensilsCrossed },
    { name: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
];

const MORE_LINKS = [
    { name: 'Leads', href: '/dashboard/leads' },
    { name: 'Food Library', href: '/dashboard/food-library' },
    { name: 'Meal Reviews', href: '/dashboard/reviews' },
    { name: 'Analytics', href: '/dashboard/analytics' },
    { name: 'Subscriptions', href: '/dashboard/subscriptions' },
    { name: 'Team', href: '/dashboard/team' },
    { name: 'Settings', href: '/dashboard/settings' },
];

export function MobileBottomNav() {
    const pathname = usePathname();
    const [moreOpen, setMoreOpen] = useState(false);
    const { data: unreadData } = useUnreadCounts();
    const unreadTotal = unreadData?.total || 0;

    const isActive = (href: string, exact?: boolean) =>
        exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

    return (
        <>
            {/* More drawer backdrop */}
            {moreOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                    onClick={() => setMoreOpen(false)}
                />
            )}

            {/* More drawer */}
            {moreOpen && (
                <div className="fixed bottom-16 left-0 right-0 z-50 bg-white border-t border-gray-200 rounded-t-2xl p-4 lg:hidden shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">More</p>
                        <button onClick={() => setMoreOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {MORE_LINKS.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMoreOpen(false)}
                                className={cn(
                                    'flex items-center justify-center py-3 px-2 rounded-xl text-sm font-medium transition-colors text-center',
                                    isActive(link.href)
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                )}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Bottom tab bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 lg:hidden safe-bottom">
                <div className="flex items-stretch h-16">
                    {PRIMARY_TABS.map((tab) => {
                        const active = isActive(tab.href, tab.exact);
                        const isMessages = tab.href === '/dashboard/messages';
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className={cn(
                                    'flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors',
                                    active ? 'text-emerald-600' : 'text-gray-400'
                                )}
                            >
                                <div className="relative">
                                    <tab.icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                                    {isMessages && unreadTotal > 0 && (
                                        <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 rounded-full bg-brand text-white text-[9px] flex items-center justify-center font-bold px-1">
                                            {unreadTotal > 9 ? '9+' : unreadTotal}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] font-medium leading-none">{tab.name}</span>
                                {active && (
                                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-emerald-600" />
                                )}
                            </Link>
                        );
                    })}
                    {/* More button */}
                    <button
                        onClick={() => setMoreOpen((o) => !o)}
                        className={cn(
                            'flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors',
                            moreOpen ? 'text-emerald-600' : 'text-gray-400'
                        )}
                    >
                        <MoreHorizontal className="w-5 h-5" strokeWidth={moreOpen ? 2.5 : 2} />
                        <span className="text-[10px] font-medium leading-none">More</span>
                    </button>
                </div>
            </nav>
        </>
    );
}
