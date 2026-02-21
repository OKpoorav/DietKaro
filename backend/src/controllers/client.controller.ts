import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { clientService } from '../services/client.service';
import type { ClientListQuery, ClientProgressQuery } from '../schemas/client.schema';

export const createClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const client = await clientService.createClient(req.body, req.user.organizationId, req.user.id);
    res.status(201).json({ success: true, data: client });
});

export const getClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const client = await clientService.getClient(req.params.id, req.user.organizationId, req.user.role, req.user.id);
    res.status(200).json({ success: true, data: client });
});

export const listClients = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { clients, meta } = await clientService.listClients(req.user.organizationId, req.query as unknown as ClientListQuery, req.user.role, req.user.id);
    res.status(200).json({ success: true, data: clients, meta });
});

export const updateClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const client = await clientService.updateClient(req.params.id, req.body, req.user.organizationId, req.user.role, req.user.id);
    res.status(200).json({ success: true, data: client });
});

export const deleteClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await clientService.deleteClient(req.params.id, req.user.organizationId);
    res.status(204).send();
});

export const getClientProgress = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await clientService.getClientProgress(req.params.id, req.user.organizationId, req.query as unknown as ClientProgressQuery, req.user.role, req.user.id);
    res.status(200).json({ success: true, data });
});
