import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

const expo = new Expo();

export class NotificationService {

    /**
     * registerDeviceToken
     * Adds a push token to the user or client profile
     */
    async registerDeviceToken(entityId: string, entityType: 'client' | 'user', token: string, orgId: string) {
        if (entityType === 'client') {
            const client = await prisma.client.findFirst({ where: { id: entityId, orgId } });
            if (!client) return;
            const tokens = new Set(client.pushTokens);
            tokens.add(token);
            await prisma.client.update({
                where: { id: entityId },
                data: { pushTokens: Array.from(tokens) }
            });
        } else {
            const user = await prisma.user.findFirst({ where: { id: entityId, orgId } });
            if (!user) return;
            const tokens = new Set(user.pushTokens);
            tokens.add(token);
            await prisma.user.update({
                where: { id: entityId },
                data: { pushTokens: Array.from(tokens) }
            });
        }
        logger.info('Device token registered', { entityId, entityType, orgId });
    }

    /**
     * sendNotification
     * Sends a push notification via Expo and saves to DB
     */
    async sendNotification(
        recipientId: string,
        recipientType: 'client' | 'user',
        orgId: string,
        title: string,
        message: string,
        data: Record<string, unknown> = {},
        category?: string
    ) {
        // Dedup: skip if same notification sent in last hour
        if (data?.entityType && data?.entityId) {
            const recent = await prisma.notification.findFirst({
                where: {
                    recipientId,
                    recipientType,
                    category: category || undefined,
                    relatedEntityId: data.entityId as string,
                    createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
                },
            });
            if (recent) {
                logger.debug('Skipping duplicate notification', { recipientId, category, entityId: data.entityId });
                return recent;
            }
        }

        // 1. Save to DB
        const notification = await prisma.notification.create({
            data: {
                recipientId,
                recipientType: recipientType === 'client' ? 'client' : 'user',
                orgId,
                type: 'push',
                category,
                title,
                message,
                relatedEntityType: data.entityType as string | undefined,
                relatedEntityId: data.entityId as string | undefined,
                deliveryStatus: 'pending'
            }
        });

        // 2. Get push tokens (scoped to org)
        let tokens: string[] = [];
        if (recipientType === 'client') {
            const client = await prisma.client.findFirst({ where: { id: recipientId, orgId } });
            tokens = client?.pushTokens || [];
        } else {
            const user = await prisma.user.findFirst({ where: { id: recipientId, orgId } });
            tokens = user?.pushTokens || [];
        }

        if (tokens.length === 0) {
            logger.warn('No push tokens for recipient', { recipientId });
            return notification;
        }

        // 3. Filter valid Expo push tokens
        const validTokens = tokens.filter(t => Expo.isExpoPushToken(t));
        if (validTokens.length === 0) {
            logger.warn('No valid Expo push tokens', { recipientId, tokenCount: tokens.length });
            return notification;
        }

        // 4. Build messages
        const messages: ExpoPushMessage[] = validTokens.map(token => ({
            to: token,
            sound: 'default' as const,
            title,
            body: message,
            data: { ...data, notificationId: notification.id },
            categoryId: category,
        }));

        // 5. Send in chunks (Expo recommends max 100 per request)
        const chunks = expo.chunkPushNotifications(messages);
        const tickets: ExpoPushTicket[] = [];

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (err) {
                logger.error('Push notification send failed', { error: err, recipientId });
            }
        }

        // 6. Update delivery status
        const allDelivered = tickets.length > 0 && tickets.every(t => t.status === 'ok');
        await prisma.notification.update({
            where: { id: notification.id },
            data: {
                deliveryStatus: allDelivered ? 'delivered' : 'failed',
                sentViaChannels: ['push'],
            },
        });

        // 7. Handle invalid tokens (remove from profile)
        for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
                await this.removeInvalidToken(recipientId, recipientType, validTokens[i]);
            }
        }

        logger.info('Push notification sent', {
            recipientId,
            title,
            ticketCount: tickets.length,
            delivered: allDelivered,
        });

        // Emit real-time socket event (best-effort)
        try {
            const { getIO } = require('../socket');
            const io = getIO();
            const room = recipientType === 'user' ? `user:${recipientId}` : `client:${recipientId}`;
            io.to(room).emit('notification:new', {
                id: notification.id,
                title,
                message,
                category,
                deepLink: data?.deepLink,
                relatedEntityType: data?.entityType,
                relatedEntityId: data?.entityId,
                createdAt: notification.createdAt,
            });
        } catch (socketErr) {
            // Socket emit is best-effort, don't fail the notification
            logger.warn('Failed to emit notification socket event', { error: (socketErr as Error).message });
        }

        return notification;
    }

    private async removeInvalidToken(entityId: string, entityType: 'client' | 'user', token: string) {
        if (entityType === 'client') {
            const entity = await prisma.client.findUnique({ where: { id: entityId } });
            if (!entity) return;
            const updatedTokens = entity.pushTokens.filter((t: string) => t !== token);
            await prisma.client.update({
                where: { id: entityId },
                data: { pushTokens: updatedTokens },
            });
        } else {
            const entity = await prisma.user.findUnique({ where: { id: entityId } });
            if (!entity) return;
            const updatedTokens = entity.pushTokens.filter((t: string) => t !== token);
            await prisma.user.update({
                where: { id: entityId },
                data: { pushTokens: updatedTokens },
            });
        }
        logger.info('Removed invalid push token', { entityId, token });
    }
}

export const notificationService = new NotificationService();
