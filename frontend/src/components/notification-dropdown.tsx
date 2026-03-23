'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Bell,
    Clock,
    MessageSquare,
    Camera,
    AlertTriangle,
    FileText,
    UtensilsCrossed,
    Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationBell, type Notification } from '@/lib/hooks/use-notifications';

const categoryIcons: Record<string, typeof Bell> = {
    plan_expiry: Clock,
    chat_message: MessageSquare,
    meal_review: Camera,
    compliance_alert: AlertTriangle,
    report_processed: FileText,
    diet_plan: UtensilsCrossed,
};

const categoryColors: Record<string, string> = {
    plan_expiry: 'text-orange-500 bg-orange-50',
    chat_message: 'text-blue-500 bg-blue-50',
    meal_review: 'text-purple-500 bg-purple-50',
    compliance_alert: 'text-red-500 bg-red-50',
    report_processed: 'text-emerald-500 bg-emerald-50',
    diet_plan: 'text-emerald-600 bg-emerald-50',
};

function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

function NotificationItem({
    notification,
    onRead,
}: {
    notification: Notification;
    onRead: (id: string, deepLink: string | null) => void;
}) {
    const Icon = categoryIcons[notification.category] || Bell;
    const colorClass = categoryColors[notification.category] || 'text-gray-500 bg-gray-50';

    return (
        <button
            onClick={() => onRead(notification.id, notification.deepLink)}
            className={cn(
                'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0',
                !notification.isRead && 'bg-emerald-50/40'
            )}
        >
            <div className={cn('flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5', colorClass)}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <p className={cn('text-sm text-gray-900 truncate', !notification.isRead && 'font-semibold')}>
                    {notification.title}
                </p>
                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{notification.message}</p>
                <p className="text-xs text-gray-400 mt-1">{timeAgo(notification.createdAt)}</p>
            </div>
            {!notification.isRead && (
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-500 mt-2" />
            )}
        </button>
    );
}

export function NotificationDropdown() {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, isMarkingAllRead } =
        useNotificationBell();

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        function handleEscape(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }
        if (open) {
            document.addEventListener('keydown', handleEscape);
        }
        return () => document.removeEventListener('keydown', handleEscape);
    }, [open]);

    const handleItemClick = (id: string, deepLink: string | null) => {
        markAsRead(id);
        setOpen(false);
        if (deepLink) {
            router.push(deepLink);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell button */}
            <button
                onClick={() => setOpen((prev) => !prev)}
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold px-1 ring-2 ring-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={() => markAllAsRead()}
                                disabled={isMarkingAllRead}
                                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
                            >
                                <Check className="w-3 h-3" />
                                Mark all as read
                            </button>
                        )}
                    </div>

                    {/* Notification list */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4">
                                <Bell className="w-10 h-10 text-gray-300 mb-2" />
                                <p className="text-sm text-gray-500">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onRead={handleItemClick}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
