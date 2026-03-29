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

        // Join immediately (socket.io buffers this if still connecting)
        socket.emit('chat:join', { conversationId });

        // Re-join after reconnects and refetch messages (picks up anything sent via REST while offline)
        const handleReconnect = () => {
            socket.emit('chat:join', { conversationId });
            queryClient.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] });
            queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
            queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] });
        };
        socket.on('connect', handleReconnect);

        const handleNewMessage = ({ message, tempId }: { message: ChatMessage; tempId?: string }) => {
            queryClient.setQueryData(['chat', 'messages', conversationId], (old: any) => {
                if (!old?.pages?.[0]) return old;

                // If we sent this message via socket, replace the optimistic temp entry
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

                // Dedup guard
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
            // Refetch messages — notification means the other party sent something
            // This fires even when the mobile hasn't joined the conversation room yet
            queryClient.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] });
        };

        const handleTyping = ({ fullName }: { fullName: string }) => setTypingUser(fullName);
        const handleStopTyping = () => setTypingUser(null);

        socket.on('chat:new_message', handleNewMessage);
        socket.on('chat:notification', handleNotification);
        socket.on('chat:user_typing', handleTyping);
        socket.on('chat:user_stop_typing', handleStopTyping);

        return () => {
            socket.emit('chat:leave', { conversationId });
            socket.off('connect', handleReconnect);
            socket.off('chat:new_message', handleNewMessage);
            socket.off('chat:notification', handleNotification);
            socket.off('chat:user_typing', handleTyping);
            socket.off('chat:user_stop_typing', handleStopTyping);
        };
    }, [conversationId, queryClient]);

    const sendMessage = useCallback(async (content: string) => {
        if (!conversationId) return;

        const tempId = Date.now().toString();

        // Optimistic UI — show the message immediately
        queryClient.setQueryData(['chat', 'messages', conversationId], (old: any) => {
            if (!old?.pages?.[0]) return old;
            const tempMsg: ChatMessage = {
                id: `temp:${tempId}`,
                conversationId,
                senderType: 'client',
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

        const socket = getSocket();
        if (socket?.connected) {
            // Socket is live — send via WebSocket (server will broadcast back)
            socket.emit('chat:send_message', { conversationId, content, tempId });
        } else {
            // Socket is down — send via REST so the message is persisted
            try {
                const { data } = await chatApi.sendMessage(conversationId, content);
                const saved = data.data as ChatMessage;
                // Replace optimistic temp message with the real one
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
    }, [conversationId, queryClient]);

    const markRead = useCallback((messageId: string) => {
        const socket = getSocket();
        if (!socket || !conversationId) return;
        socket.emit('chat:mark_read', { conversationId, messageId });
    }, [conversationId]);

    return { sendMessage, markRead, typingUser };
}
