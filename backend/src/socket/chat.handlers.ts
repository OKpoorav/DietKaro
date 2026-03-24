import { Server, Socket } from 'socket.io';
import { chatService } from '../services/chat.service';
import { invalidateChatCache } from '../controllers/chat.controller';
import logger from '../utils/logger';

export function registerChatHandlers(io: Server, socket: Socket) {
    const { userId, userType, orgId } = socket.data;

    // Per-socket rate limiter for chat:send_message (max 10 messages per 10 seconds)
    const messageTimestamps: number[] = [];

    socket.on('chat:join', async ({ conversationId }: { conversationId: string }) => {
        try {
            const conversation = await chatService.getConversation(conversationId);
            if (!conversation || conversation.orgId !== orgId) {
                return socket.emit('chat:error', { message: 'Conversation not found', code: 'NOT_FOUND' });
            }

            const isParticipant =
                (userType === 'user' && conversation.userId === userId) ||
                (userType === 'client' && conversation.clientId === userId);

            if (!isParticipant) {
                return socket.emit('chat:error', { message: 'Not a participant', code: 'FORBIDDEN' });
            }

            socket.join(`conversation:${conversationId}`);
        } catch (error) {
            logger.error('chat:join failed', { error, conversationId, userId });
            socket.emit('chat:error', { message: 'Failed to join conversation', code: 'JOIN_FAILED' });
        }
    });

    socket.on('chat:leave', ({ conversationId }: { conversationId: string }) => {
        socket.leave(`conversation:${conversationId}`);
    });

    socket.on('chat:send_message', async ({ conversationId, content, tempId }: { conversationId: string; content: string; tempId: string }, callback?: (res: any) => void) => {
        // Rate limiting: max 10 messages per 10 seconds
        const now = Date.now();
        const windowStart = now - 10000;
        while (messageTimestamps.length > 0 && messageTimestamps[0] < windowStart) {
            messageTimestamps.shift();
        }
        if (messageTimestamps.length >= 10) {
            callback?.({ error: 'Rate limit exceeded, please slow down' });
            return;
        }
        messageTimestamps.push(now);

        try {
            // Verify sender has joined the conversation room (participation check)
            if (!socket.rooms.has(`conversation:${conversationId}`)) {
                return socket.emit('chat:error', { message: 'You must join the conversation before sending messages', code: 'FORBIDDEN' });
            }

            const message = await chatService.sendMessage({
                conversationId,
                senderId: userId,
                senderType: userType,
                content,
                orgId,
            });

            // Broadcast to everyone in the conversation room
            io.to(`conversation:${conversationId}`).emit('chat:new_message', {
                message,
                tempId,
            });

            // Invalidate server-side cache for both participants so the next
            // REST poll gets fresh conversation/unread data immediately.
            invalidateChatCache(userId);

            const conversation = await chatService.getConversation(conversationId);
            if (conversation) {
                const targetType = userType === 'user' ? 'client' : 'user';
                const targetId = (userType === 'user' ? conversation.clientId : conversation.userId) ?? '';
                if (targetId) invalidateChatCache(targetId);
                // Notify recipient's personal room for unread badge (separate event to
                // avoid duplicate chat:new_message when recipient is in conversation room).
                socket.to(`${targetType}:${targetId}`).emit('chat:notification', {
                    conversationId,
                    messageId: message.id,
                });

                // Send push notification to the other participant
                try {
                    const NotificationService = require('../services/notification.service').notificationService;
                    if (userType === 'user' && conversation.clientId) {
                        // Dietitian sent message → notify client
                        await NotificationService.sendNotification(
                            conversation.clientId, 'client', orgId,
                            'New message from your dietitian',
                            content.substring(0, 100),
                            { entityType: 'conversation', entityId: conversationId, deepLink: `/chat/${conversationId}` },
                            'chat_message'
                        );
                    } else if (userType === 'client' && conversation.userId) {
                        // Client sent message → notify dietitian
                        await NotificationService.sendNotification(
                            conversation.userId, 'user', orgId,
                            `New message from client`,
                            content.substring(0, 100),
                            { entityType: 'conversation', entityId: conversationId, deepLink: `/dashboard/messages?conversation=${conversationId}` },
                            'chat_message'
                        );
                    }
                } catch (notifErr) {
                    logger.warn('Failed to send chat notification', { error: (notifErr as Error).message });
                }
            }
        } catch (error) {
            logger.error('chat:send_message failed', { error, conversationId, userId });
            socket.emit('chat:error', { message: 'Failed to send message', code: 'SEND_FAILED' });
        }
    });

    socket.on('chat:typing', ({ conversationId }: { conversationId: string }) => {
        socket.to(`conversation:${conversationId}`).emit('chat:user_typing', {
            conversationId,
            userId,
            fullName: socket.data.fullName,
        });
    });

    socket.on('chat:stop_typing', ({ conversationId }: { conversationId: string }) => {
        socket.to(`conversation:${conversationId}`).emit('chat:user_stop_typing', {
            conversationId,
            userId,
        });
    });

    socket.on('chat:mark_read', async ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
        try {
            await chatService.markAsRead(conversationId, userId, userType, messageId);

            socket.to(`conversation:${conversationId}`).emit('chat:message_read', {
                conversationId,
                readBy: userId,
                readAt: new Date().toISOString(),
                upToMessageId: messageId,
            });
        } catch (error) {
            logger.error('chat:mark_read failed', { error, conversationId, userId });
        }
    });
}
