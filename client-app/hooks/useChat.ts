import { useQuery, useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect, useState, useCallback } from 'react';
import { chatApi } from '../services/api';
import { getSocket } from '../services/socket';

export interface ChatMessage {
    id: string;
    conversationId: string;
    senderType: 'user' | 'client';
    senderId: string;
    content: string;
    status: 'sent' | 'delivered' | 'read';
    readAt: string | null;
    createdAt: string;
}

export interface ChatConversation {
    id: string;
    userId: string;
    clientId: string;
    lastMessageAt: string | null;
    lastMessageText: string | null;
    unreadCount: number;
    user: { id: string; fullName: string; profilePhotoUrl: string | null };
    client: { id: string; fullName: string; profilePhotoUrl: string | null };
}

export function useConversations() {
    return useQuery({
        queryKey: ['chat', 'conversations'],
        queryFn: async () => {
            const { data } = await chatApi.getConversations();
            return data.data as ChatConversation[];
        },
        staleTime: 10 * 1000,
    });
}

export function useInitiateConversation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const { data } = await chatApi.initiateConversation();
            return data.data as ChatConversation;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
        },
    });
}

export function useChatMessages(conversationId: string) {
    return useInfiniteQuery({
        queryKey: ['chat', 'messages', conversationId],
        queryFn: async ({ pageParam }) => {
            const { data } = await chatApi.getMessages(conversationId, pageParam);
            return {
                messages: data.data as ChatMessage[],
                nextCursor: data.meta?.nextCursor as string | undefined,
                hasMore: data.meta?.hasMore as boolean,
            };
        },
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: !!conversationId,
    });
}

export function useUnreadCounts() {
    return useQuery({
        queryKey: ['chat', 'unread'],
        queryFn: async () => {
            const { data } = await chatApi.getUnreadCounts();
            return data.data;
        },
        staleTime: 15 * 1000,
        refetchInterval: 30 * 1000,
    });
}

export function useChatSocket(conversationId: string | null) {
    const queryClient = useQueryClient();
    const [typingUser, setTypingUser] = useState<string | null>(null);

    useEffect(() => {
        if (!conversationId) return;

        const socket = getSocket();
        if (!socket) return;

        socket.emit('chat:join', { conversationId });

        const handleNewMessage = ({ message }: { message: ChatMessage }) => {
            // Optimistic prepend with dedup guard (same as frontend)
            queryClient.setQueryData(['chat', 'messages', conversationId], (old: any) => {
                if (!old?.pages?.[0]) return old;
                const alreadyExists = old.pages.some((page: any) =>
                    page.messages.some((m: any) => m.id === message.id)
                );
                if (alreadyExists) return old;
                return {
                    ...old,
                    pages: [
                        {
                            messages: [message, ...old.pages[0].messages],
                            nextCursor: old.pages[0].nextCursor,
                            hasMore: old.pages[0].hasMore,
                        },
                        ...old.pages.slice(1),
                    ],
                };
            });
            queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
            queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] });
        };

        const handleNotification = () => {
            queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
            queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] });
        };

        const handleTyping = ({ fullName }: { fullName: string }) => setTypingUser(fullName);
        const handleStopTyping = () => setTypingUser(null);

        socket.on('chat:new_message', handleNewMessage);
        socket.on('chat:notification', handleNotification);
        socket.on('chat:user_typing', handleTyping);
        socket.on('chat:user_stop_typing', handleStopTyping);

        return () => {
            socket.emit('chat:leave', { conversationId });
            socket.off('chat:new_message', handleNewMessage);
            socket.off('chat:notification', handleNotification);
            socket.off('chat:user_typing', handleTyping);
            socket.off('chat:user_stop_typing', handleStopTyping);
        };
    }, [conversationId, queryClient]);

    const sendMessage = useCallback((content: string) => {
        const socket = getSocket();
        if (!socket || !conversationId) return;
        socket.emit('chat:send_message', { conversationId, content, tempId: Date.now().toString() });
    }, [conversationId]);

    const markRead = useCallback((messageId: string) => {
        const socket = getSocket();
        if (!socket || !conversationId) return;
        socket.emit('chat:mark_read', { conversationId, messageId });
    }, [conversationId]);

    return { sendMessage, markRead, typingUser };
}
