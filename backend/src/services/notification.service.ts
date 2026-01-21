import prisma from '../utils/prisma';
import logger from '../utils/logger';
// import { Expo } from 'expo-server-sdk'; // TODO: Install expo-server-sdk

// const expo = new Expo();

export class NotificationService {

    /**
     * registerDeviceToken
     * Adds a push token to the user or client profile
     */
    async registerDeviceToken(entityId: string, entityType: 'client' | 'user', token: string) {
        if (entityType === 'client') {
            const client = await prisma.client.findUnique({ where: { id: entityId } });
            if (!client) return;
            const tokens = new Set(client.pushTokens);
            tokens.add(token);
            await prisma.client.update({
                where: { id: entityId },
                data: { pushTokens: Array.from(tokens) }
            });
        } else {
            const user = await prisma.user.findUnique({ where: { id: entityId } });
            if (!user) return;
            const tokens = new Set(user.pushTokens);
            tokens.add(token);
            await prisma.user.update({
                where: { id: entityId },
                data: { pushTokens: Array.from(tokens) }
            });
        }
        logger.info('Device token registered', { entityId, entityType });
    }

    /**
     * sendNotification
     * Sends a push notification and saves to DB
     */
    async sendNotification(
        recipientId: string,
        recipientType: 'client' | 'user',
        orgId: string,
        title: string,
        message: string,
        data: any = {},
        category?: string
    ) {
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
                relatedEntityType: data.entityType,
                relatedEntityId: data.entityId,
                deliveryStatus: 'pending'
            }
        });

        // 2. Get tokens
        let tokens: string[] = [];
        if (recipientType === 'client') {
            const client = await prisma.client.findUnique({ where: { id: recipientId } });
            tokens = client?.pushTokens || [];
        } else {
            const user = await prisma.user.findUnique({ where: { id: recipientId } });
            tokens = user?.pushTokens || [];
        }

        if (tokens.length === 0) {
            logger.warn('No tokens found for recipient', { recipientId });
            return notification;
        }

        // 3. Send via Expo (Placeholder)
        // const messages = tokens.map(token => ({
        //     to: token,
        //     sound: 'default',
        //     title,
        //     body: message,
        //     data: { ...data, notificationId: notification.id },
        // }));

        // await expo.sendPushNotificationsAsync(messages);

        logger.info('Notification sent (simulated)', { recipientId, title });

        // Update status
        await prisma.notification.update({
            where: { id: notification.id },
            data: { deliveryStatus: 'delivered', sentViaChannels: ['push_simulated'] }
        });

        return notification;
    }
}

export const notificationService = new NotificationService();
