import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { ClientAuthRequest } from '../middleware/clientAuth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import { chatService } from '../services/chat.service';
import prisma from '../utils/prisma';
import cache from '../utils/cache';

function chatCacheKey(type: 'conversations' | 'unread', entityId: string) {
    return `chat:${type}:${entityId}`;
}

export function invalidateChatCache(entityId: string) {
    cache.del(chatCacheKey('conversations', entityId));
    cache.del(chatCacheKey('unread', entityId));
}

// ============ DIETITIAN (User) ENDPOINTS ============

export const getOrCreateConversation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { clientId } = req.params;

    // IDOR check: verify the user has access to this client (same org + assigned if dietitian)
    const client = await prisma.client.findFirst({
        where: { id: clientId, orgId: req.user.organizationId, isActive: true },
        select: { primaryDietitianId: true },
    });
    if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');
    if (req.user.role === 'dietitian' && client.primaryDietitianId !== req.user.id) {
        throw AppError.forbidden('You can only message your assigned clients');
    }

    const conversation = await chatService.createOrGetConversation(
        req.user.id, clientId, req.user.organizationId
    );
    res.json({ success: true, data: conversation });
});

export const listUserConversations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const key = chatCacheKey('conversations', req.user.id) + `:${page}:${limit}`;
    const cached = cache.get(key);
    if (cached) return res.json({ success: true, data: cached });
    const conversations = await chatService.listConversations(
        req.user.id, 'user', req.user.organizationId, limit, skip
    );
    cache.set(key, conversations, 5);
    res.json({ success: true, data: conversations });
});

export const getUserMessages = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { conversationId } = req.params;
    const { cursor, limit } = req.query;
    const result = await chatService.getMessages(
        conversationId,
        req.user.organizationId,
        req.user.id,
        'user',
        { cursor: cursor as string, limit: limit ? Number(limit) : undefined }
    );
    res.json({ success: true, data: result.messages, meta: { hasMore: result.hasMore, nextCursor: result.nextCursor } });
});

export const getUserUnreadCounts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const key = chatCacheKey('unread', req.user.id);
    const cached = cache.get(key);
    if (cached) return res.json({ success: true, data: cached });
    const counts = await chatService.getUnreadCounts(req.user.organizationId, req.user.id, 'user');
    const total = counts.reduce((sum, c) => sum + c.unreadCount, 0);
    const data = { conversations: counts, total };
    cache.set(key, data, 5);
    res.json({ success: true, data });
});

// ============ CLIENT (Mobile) ENDPOINTS ============

export const initiateClientConversation = asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const client = await prisma.client.findUnique({
        where: { id: req.client.id },
        select: { primaryDietitianId: true },
    });
    if (!client) throw AppError.notFound('Client not found');
    if (!client.primaryDietitianId) throw AppError.badRequest('No dietitian assigned to your profile yet');
    const conversation = await chatService.createOrGetConversation(
        client.primaryDietitianId, req.client.id, req.client.orgId
    );
    res.json({ success: true, data: conversation });
});

export const listClientConversations = asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;
    const key = chatCacheKey('conversations', req.client.id) + `:${page}:${limit}`;
    const cached = cache.get(key);
    if (cached) return res.json({ success: true, data: cached });
    const conversations = await chatService.listConversations(
        req.client.id, 'client', req.client.orgId, limit, skip
    );
    cache.set(key, conversations, 5);
    res.json({ success: true, data: conversations });
});

export const getClientMessages = asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const { conversationId } = req.params;
    const { cursor, limit } = req.query;
    const result = await chatService.getMessages(
        conversationId,
        req.client.orgId,
        req.client.id,
        'client',
        { cursor: cursor as string, limit: limit ? Number(limit) : undefined }
    );
    res.json({ success: true, data: result.messages, meta: { hasMore: result.hasMore, nextCursor: result.nextCursor } });
});

export const getClientUnreadCounts = asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const key = chatCacheKey('unread', req.client.id);
    const cached = cache.get(key);
    if (cached) return res.json({ success: true, data: cached });
    const counts = await chatService.getUnreadCounts(req.client.orgId, req.client.id, 'client');
    const total = counts.reduce((sum, c) => sum + c.unreadCount, 0);
    const data = { conversations: counts, total };
    cache.set(key, data, 5);
    res.json({ success: true, data });
});
