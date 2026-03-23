import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notificationsApi } from '../services/api';
import { getSocket } from '../services/socket';
import { Notification } from '../types';

export function useNotifications() {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            const { data } = await notificationsApi.list();
            return data.data as Notification[];
        },
        staleTime: 30 * 1000,
    });

    const markReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await notificationsApi.markRead(id);
            return id;
        },
        onMutate: async (id: string) => {
            await queryClient.cancelQueries({ queryKey: ['notifications'] });
            const previous = queryClient.getQueryData<Notification[]>(['notifications']);

            queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
                old?.map((n) => (n.id === id ? { ...n, isRead: true } : n))
            );

            return { previous };
        },
        onError: (_err, _id, context) => {
            if (context?.previous) {
                queryClient.setQueryData(['notifications'], context.previous);
            }
        },
    });

    // Listen for real-time notifications via socket
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleNewNotification = (notification: Notification) => {
            queryClient.setQueryData<Notification[]>(['notifications'], (old) => {
                if (!old) return [notification];
                const exists = old.some((n) => n.id === notification.id);
                if (exists) return old;
                return [notification, ...old];
            });
        };

        socket.on('notification:new', handleNewNotification);

        return () => {
            socket.off('notification:new', handleNewNotification);
        };
    }, [queryClient]);

    const notifications = query.data ?? [];
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return {
        notifications,
        unreadCount,
        isLoading: query.isLoading,
        refetch: query.refetch,
        markAsRead: markReadMutation.mutate,
    };
}

export function useUnreadNotificationCount() {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            const { data } = await notificationsApi.list();
            return data.data as Notification[];
        },
        staleTime: 30 * 1000,
        refetchInterval: 60 * 1000,
    });

    // Listen for real-time notifications via socket
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleNewNotification = (notification: Notification) => {
            queryClient.setQueryData<Notification[]>(['notifications'], (old) => {
                if (!old) return [notification];
                const exists = old.some((n) => n.id === notification.id);
                if (exists) return old;
                return [notification, ...old];
            });
        };

        socket.on('notification:new', handleNewNotification);

        return () => {
            socket.off('notification:new', handleNewNotification);
        };
    }, [queryClient]);

    const notifications = query.data ?? [];
    return notifications.filter((n) => !n.isRead).length;
}
