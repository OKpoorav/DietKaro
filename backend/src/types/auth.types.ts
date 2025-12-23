import { Request } from 'express';
import { User } from '@prisma/client';

export interface AuthenticatedUser {
    id: string;
    clerkUserId: string;
    organizationId: string;
    role: string;
    email: string;
    fullName: string;
}

export interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
    dbUser?: User;
}
