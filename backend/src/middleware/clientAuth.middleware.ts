import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

export interface ClientAuthRequest extends Request {
    client?: {
        id: string;
        fullName: string;
        phone: string;
        email: string;
        orgId: string;
    };
}

const JWT_SECRET = process.env.CLIENT_JWT_SECRET || 'client-secret-change-in-production';

export const requireClientAuth = async (
    req: ClientAuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'No token provided' },
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as { clientId: string };

        const client = await prisma.client.findUnique({
            where: { id: decoded.clientId },
            select: {
                id: true,
                fullName: true,
                phone: true,
                email: true,
                orgId: true,
                isActive: true,
            },
        });

        if (!client || !client.isActive) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Invalid or inactive client' },
            });
        }

        req.client = {
            id: client.id,
            fullName: client.fullName,
            phone: client.phone,
            email: client.email,
            orgId: client.orgId,
        };

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
        });
    }
};

export const signClientToken = (clientId: string): string => {
    return jwt.sign({ clientId }, JWT_SECRET, { expiresIn: '30d' });
};
