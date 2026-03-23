'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';
import { useSocket } from '../socket/socket-provider';
import { useEffect, useMemo } from 'react';

// Types
export interface Notification {
    id: string;
    category: 'plan_expiry' | 'chat_message' | 'meal_review' | 'compliance_alert' | 'report_processed' | 'diet_plan';
    title: string;
    message: string;
    deepLink: string | null;
    isRead: boolean;
    createdAt: string;
}

interface NotificationsResponse {
    success: boolean;
    data: Notification[];
    meta: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

// Fetch notifications
export function useNotifications(page = 1, pageSize = 20) {
    const api = useApiClient();

    return useQuery({
        queryKey: ['notifications', page, pageSize],
        queryFn: async () => {
            const { data } = await api.get<NotificationsResponse>('/notifications', {
                params: { page, pageSize },
            });
            return data;
        },
        staleTime: 15 * 1000,
        refetchOnWindowFocus: true,
    });
}

// Mark single notification as read
export function useMarkAsRead() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            await api.patch(`/notifications/${id}/read`);
            return id;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['notifications'] });
            queryClient.setQueriesData<NotificationsResponse>(
                { queryKey: ['notifications'] },
                (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        data: old.data.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
                    };
                }
            );
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
}

// Mark all notifications as read
export function useMarkAllAsRead() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            await api.patch('/notifications/read-all');
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['notifications'] });
            queryClient.setQueriesData<NotificationsResponse>(
                { queryKey: ['notifications'] },
                (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        data: old.data.map((n) => ({ ...n, isRead: true })),
                    };
                }
            );
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
}

// Real-time notification listener
export function useNotificationSocket() {
    const { socket } = useSocket();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (notification: Notification) => {
            // Prepend new notification to the first page
            queryClient.setQueriesData<NotificationsResponse>(
                { queryKey: ['notifications'] },
                (old) => {
                    if (!old) return old;
                    // Avoid duplicates
                    if (old.data.some((n) => n.id === notification.id)) return old;
                    return {
                        ...old,
                        data: [notification, ...old.data],
                        meta: { ...old.meta, total: old.meta.total + 1 },
                    };
                }
            );
        };

        socket.on('notification:new', handleNewNotification);

        return () => {
            socket.off('notification:new', handleNewNotification);
        };
    }, [socket, queryClient]);
}

// Convenience hook that combines everything
export function useNotificationBell() {
    const { data, isLoading } = useNotifications();
    const markAsRead = useMarkAsRead();
    const markAllAsRead = useMarkAllAsRead();

    // Listen for real-time notifications
    useNotificationSocket();

    const notifications = data?.data ?? [];
    const unreadCount = useMemo(
        () => notifications.filter((n) => !n.isRead).length,
        [notifications]
    );

    return {
        notifications,
        unreadCount,
        isLoading,
        markAsRead: markAsRead.mutate,
        markAllAsRead: markAllAsRead.mutate,
        isMarkingAllRead: markAllAsRead.isPending,
    };
}
