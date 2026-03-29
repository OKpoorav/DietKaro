import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { clientService } from '../services/client.service';
import cache from '../utils/cache';
import type { ClientListQuery, ClientProgressQuery } from '../schemas/client.schema';

function clientListCacheKey(orgId: string, userId: string, query: Record<string, unknown>) {
    return `clients:list:${orgId}:${userId}:${JSON.stringify(query)}`;
}

function invalidateClientListCache(orgId: string) {
    const prefix = `clients:list:${orgId}:`;
    const keys = cache.keys().filter(k => k.startsWith(prefix));
    if (keys.length > 0) cache.del(keys);
}

export const createClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const reactivate = req.body.reactivate === true;
    const client = await clientService.createClient(req.body, req.user.organizationId, req.user.id, reactivate);
    invalidateClientListCache(req.user.organizationId);
    res.status(201).json({ success: true, data: client });
});

export const getClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const client = await clientService.getClient(req.params.id, req.user.organizationId, req.user.role, req.user.id);
    res.status(200).json({ success: true, data: client });
});

export const listClients = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const key = clientListCacheKey(req.user.organizationId, req.user.id, req.query as Record<string, unknown>);
    const cached = cache.get<{ clients: unknown[]; meta: unknown }>(key);
    if (cached) return res.status(200).json({ success: true, data: cached.clients, meta: cached.meta });
    const { clients, meta } = await clientService.listClients(req.user.organizationId, req.query as unknown as ClientListQuery, req.user.role, req.user.id);
    cache.set(key, { clients, meta }, 30);
    res.status(200).json({ success: true, data: clients, meta });
});

export const updateClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const client = await clientService.updateClient(req.params.id, req.body, req.user.organizationId, req.user.role, req.user.id);
    invalidateClientListCache(req.user.organizationId);
    res.status(200).json({ success: true, data: client });
});

export const deleteClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await clientService.deleteClient(req.params.id, req.user.organizationId);
    invalidateClientListCache(req.user.organizationId);
    res.status(204).send();
});

export const getClientProgress = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await clientService.getClientProgress(req.params.id, req.user.organizationId, req.query as unknown as ClientProgressQuery, req.user.role, req.user.id);
    res.status(200).json({ success: true, data });
});
