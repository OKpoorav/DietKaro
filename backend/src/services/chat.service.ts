import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';

interface SendMessageInput {
    conversationId: string;
    senderId: string;
    senderType: 'user' | 'client';
    content: string;
    orgId: string;
}

export class ChatService {
    /**
     * Get or create a conversation between a user and client.
     */
    async createOrGetConversation(userId: string, clientId: string, orgId: string) {
        const [user, client] = await Promise.all([
            prisma.user.findFirst({ where: { id: userId, orgId, isActive: true } }),
            prisma.client.findFirst({ where: { id: clientId, orgId, isActive: true } }),
        ]);

        if (!user) throw AppError.notFound('User not found');
        if (!client) throw AppError.notFound('Client not found');

        const conversation = await prisma.conversation.upsert({
            where: {
                orgId_userId_clientId: { orgId, userId, clientId },
            },
            update: {},
            create: { orgId, userId, clientId },
            include: {
                user: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                client: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            },
        });

        return conversation;
    }

    /**
     * Get a single conversation by ID.
     */
    async getConversation(conversationId: string) {
        return prisma.conversation.findUnique({
            where: { id: conversationId },
        });
    }

    /**
     * Send a message and update conversation metadata atomically.
     */
    async sendMessage({ conversationId, senderId, senderType, content, orgId }: SendMessageInput) {
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });

        if (!conversation || conversation.orgId !== orgId) {
            throw AppError.notFound('Conversation not found');
        }

        const isParticipant =
            (senderType === 'user' && conversation.userId === senderId) ||
            (senderType === 'client' && conversation.clientId === senderId);

        if (!isParticipant) {
            throw AppError.forbidden('Not a participant in this conversation');
        }

        const trimmed = content.trim();
        if (!trimmed) {
            throw AppError.badRequest('Message content cannot be empty');
        }

        const [message] = await prisma.$transaction([
            prisma.message.create({
                data: {
                    conversationId,
                    senderId,
                    senderType: senderType as any,
                    content: trimmed,
                    status: 'sent',
                },
            }),
            prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    lastMessageAt: new Date(),
                    lastMessageText: trimmed.substring(0, 100),
                },
            }),
        ]);

        logger.info('Message sent', { messageId: message.id, conversationId, senderType });
        return message;
    }

    /**
     * Get messages with cursor-based pagination.
     */
    async getMessages(
        conversationId: string,
        orgId: string,
        requesterId: string,
        requesterType: 'user' | 'client',
        options: { cursor?: string; limit?: number } = {}
    ) {
        const { cursor, limit = 50 } = options;

        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });

        if (!conversation || conversation.orgId !== orgId) {
            throw AppError.notFound('Conversation not found');
        }

        const isParticipant =
            (requesterType === 'user' && conversation.userId === requesterId) ||
            (requesterType === 'client' && conversation.clientId === requesterId);

        if (!isParticipant) {
            throw AppError.forbidden('Not a participant');
        }

        const where: any = { conversationId };
        if (cursor) {
            where.createdAt = { lt: new Date(cursor) };
        }

        const messages = await prisma.message.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit + 1,
        });

        const hasMore = messages.length > limit;
        if (hasMore) messages.pop();

        return {
            messages,
            hasMore,
            nextCursor: hasMore ? messages[messages.length - 1].createdAt.toISOString() : null,
        };
    }

    /**
     * Mark messages as read up to a given message.
     */
    async markAsRead(
        conversationId: string,
        readerId: string,
        readerType: 'user' | 'client',
        upToMessageId: string
    ) {
        const targetMessage = await prisma.message.findUnique({
            where: { id: upToMessageId },
        });

        if (!targetMessage || targetMessage.conversationId !== conversationId) {
            return;
        }

        // Mark the other person's messages as read
        const otherType = readerType === 'user' ? 'client' : 'user';
        await prisma.message.updateMany({
            where: {
                conversationId,
                senderType: otherType as any,
                createdAt: { lte: targetMessage.createdAt },
                status: { not: 'read' },
            },
            data: {
                status: 'read',
                readAt: new Date(),
            },
        });
    }

    /**
     * Get unread message counts per conversation.
     * Single query via JOIN instead of 2 sequential queries.
     */
    async getUnreadCounts(orgId: string, entityId: string, entityType: 'user' | 'client') {
        const otherType = entityType === 'user' ? 'client' : 'user';

        if (entityType === 'user') {
            return prisma.$queryRaw<Array<{ conversationId: string; unreadCount: number }>>`
                SELECT m."conversationId", COUNT(*)::int AS "unreadCount"
                FROM "Message" m
                INNER JOIN "Conversation" c ON c.id = m."conversationId"
                WHERE c."orgId" = ${orgId}
                  AND c."userId" = ${entityId}
                  AND m."senderType"::text = ${otherType}
                  AND m.status::text != 'read'
                GROUP BY m."conversationId"
            `;
        } else {
            return prisma.$queryRaw<Array<{ conversationId: string; unreadCount: number }>>`
                SELECT m."conversationId", COUNT(*)::int AS "unreadCount"
                FROM "Message" m
                INNER JOIN "Conversation" c ON c.id = m."conversationId"
                WHERE c."orgId" = ${orgId}
                  AND c."clientId" = ${entityId}
                  AND m."senderType"::text = ${otherType}
                  AND m.status::text != 'read'
                GROUP BY m."conversationId"
            `;
        }
    }

    /**
     * List conversations sorted by most recent message.
     * Runs conversations + unread counts in parallel (2 queries vs 3 sequential).
     */
    async listConversations(entityId: string, entityType: 'user' | 'client', orgId: string, take: number = 50, skip: number = 0) {
        const whereClause = entityType === 'user'
            ? { userId: entityId, orgId }
            : { clientId: entityId, orgId };

        const [conversations, unreadCounts] = await Promise.all([
            prisma.conversation.findMany({
                where: whereClause,
                orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
                take,
                skip,
                include: {
                    user: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                    client: { select: { id: true, fullName: true, profilePhotoUrl: true } },
                },
            }),
            this.getUnreadCounts(orgId, entityId, entityType),
        ]);

        const countMap = new Map(unreadCounts.map(c => [c.conversationId, c.unreadCount]));

        return conversations.map(conv => ({
            ...conv,
            unreadCount: countMap.get(conv.id) || 0,
        }));
    }
}

export const chatService = new ChatService();
