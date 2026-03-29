'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';
import { useSocket } from '../socket/socket-provider';
import { useEffect, useCallback, useState, useRef } from 'react';

// Types
export interface Message {
    id: string;
    conversationId: string;
    senderType: 'user' | 'client';
    senderId: string;
    content: string;
    status: 'sent' | 'delivered' | 'read';
    readAt: string | null;
    createdAt: string;
}

export interface Conversation {
    id: string;
    orgId: string;
    userId: string;
    clientId: string;
    lastMessageAt: string | null;
    lastMessageText: string | null;
    unreadCount: number;
    user: { id: string; fullName: string; profilePhotoUrl: string | null };
    client: { id: string; fullName: string; profilePhotoUrl: string | null };
}

// List all conversations
export function useConversations() {
    const api = useApiClient();
    return useQuery({
        queryKey: ['chat', 'conversations'],
        queryFn: async () => {
            const { data } = await api.get('/chat/conversations');
            return data.data as Conversation[];
        },
        staleTime: 10 * 1000,
    });
}

// Get or create a conversation with a client
export function useCreateConversation() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (clientId: string) => {
            const { data } = await api.post(`/chat/conversations/with/${clientId}`);
            return data.data as Conversation;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
        },
    });
}

// Infinite query for message history
export function useMessages(conversationId: string | null) {
    const api = useApiClient();
    return useInfiniteQuery({
        queryKey: ['chat', 'messages', conversationId],
        queryFn: async ({ pageParam }) => {
            const params: Record<string, string | number> = { limit: 50 };
            if (pageParam) params.cursor = pageParam;
            const { data } = await api.get(`/chat/conversations/${conversationId}/messages`, { params });
            return {
                messages: data.data as Message[],
                nextCursor: data.meta?.nextCursor as string | null,
                hasMore: data.meta?.hasMore as boolean,
            };
        },
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: !!conversationId,
    });
}

// Unread counts for badge
export function useUnreadCounts() {
    const api = useApiClient();
    return useQuery({
        queryKey: ['chat', 'unread'],
        queryFn: async () => {
            const { data } = await api.get('/chat/unread');
            return data.data as { conversations: { conversationId: string; unreadCount: number }[]; total: number };
        },
        staleTime: 15 * 1000,
        refetchInterval: 30 * 1000,
    });
}

// Real-time message subscription
export function useChatSocket(conversationId: string | null) {
    const { socket } = useSocket();
    const queryClient = useQueryClient();
    const [typingUser, setTypingUser] = useState<string | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        if (!socket || !conversationId) return;

        socket.emit('chat:join', { conversationId });

        const handleNewMessage = ({ message, tempId }: { message: Message; tempId?: string }) => {
            if (message.conversationId === conversationId) {
                queryClient.setQueryData(['chat', 'messages', conversationId], (old: any) => {
                    if (!old?.pages?.[0]) return old;

                    // If we sent this message, replace the optimistic temp entry
                    if (tempId) {
                        const tempMsgId = `temp:${tempId}`;
                        let replaced = false;
                        const newPages = old.pages.map((page: any) => ({
                            ...page,
                            messages: page.messages.map((m: any) => {
                                if (m.id === tempMsgId) { replaced = true; return message; }
                                return m;
                            }),
                        }));
                        if (replaced) return { ...old, pages: newPages };
                    }

                    // Dedup guard for received messages
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
            }
            queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
            queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] });
        };

        const handleTyping = ({ fullName }: { fullName: string }) => {
            setTypingUser(fullName);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
        };

        const handleStopTyping = () => setTypingUser(null);

        const handleReadReceipt = () => {
            queryClient.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] });
        };

        const handleNotification = () => {
            queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
            queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] });
        };

        socket.on('chat:new_message', handleNewMessage);
        socket.on('chat:notification', handleNotification);
        socket.on('chat:user_typing', handleTyping);
        socket.on('chat:user_stop_typing', handleStopTyping);
        socket.on('chat:message_read', handleReadReceipt);

        return () => {
            socket.emit('chat:leave', { conversationId });
            socket.off('chat:new_message', handleNewMessage);
            socket.off('chat:notification', handleNotification);
            socket.off('chat:user_typing', handleTyping);
            socket.off('chat:user_stop_typing', handleStopTyping);
            socket.off('chat:message_read', handleReadReceipt);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, [socket, conversationId, queryClient]);

    const apiRef = useRef<ReturnType<typeof useApiClient> | null>(null);
    const apiClient = useApiClient();
    apiRef.current = apiClient;

    const sendMessage = useCallback(async (content: string) => {
        if (!conversationId) return;
        const tempId = crypto.randomUUID();

        // Optimistic update — show message immediately
        queryClient.setQueryData(['chat', 'messages', conversationId], (old: any) => {
            if (!old?.pages?.[0]) return old;
            const tempMsg: Message = {
                id: `temp:${tempId}`,
                conversationId,
                senderType: 'user',
                senderId: '',
                content,
                status: 'sent',
                readAt: null,
                createdAt: new Date().toISOString(),
            };
            return {
                ...old,
                pages: [
                    {
                        messages: [tempMsg, ...old.pages[0].messages],
                        nextCursor: old.pages[0].nextCursor,
                        hasMore: old.pages[0].hasMore,
                    },
                    ...old.pages.slice(1),
                ],
            };
        });

        if (socket?.connected) {
            socket.emit('chat:send_message', { conversationId, content, tempId });
        } else {
            // Socket is down — send via REST so the message is persisted
            try {
                const { data } = await apiRef.current!.post(
                    `/chat/conversations/${conversationId}/messages`,
                    { content }
                );
                const saved = data.data as Message;
                queryClient.setQueryData(['chat', 'messages', conversationId], (old: any) => {
                    if (!old?.pages) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page: any) => ({
                            ...page,
                            messages: page.messages.map((m: any) =>
                                m.id === `temp:${tempId}` ? saved : m
                            ),
                        })),
                    };
                });
                queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
            } catch (err) {
                console.error('Failed to send message via REST:', err);
                // Remove the optimistic message on failure
                queryClient.setQueryData(['chat', 'messages', conversationId], (old: any) => {
                    if (!old?.pages) return old;
                    return {
                        ...old,
                        pages: old.pages.map((page: any) => ({
                            ...page,
                            messages: page.messages.filter((m: any) => m.id !== `temp:${tempId}`),
                        })),
                    };
                });
            }
        }
    }, [socket, conversationId, queryClient]);

    const sendTyping = useCallback(() => {
        if (!socket || !conversationId) return;
        socket.emit('chat:typing', { conversationId });
    }, [socket, conversationId]);

    const sendStopTyping = useCallback(() => {
        if (!socket || !conversationId) return;
        socket.emit('chat:stop_typing', { conversationId });
    }, [socket, conversationId]);

    const markRead = useCallback((messageId: string) => {
        if (!socket || !conversationId) return;
        socket.emit('chat:mark_read', { conversationId, messageId });
    }, [socket, conversationId]);

    return { sendMessage, sendTyping, sendStopTyping, markRead, typingUser };
}
