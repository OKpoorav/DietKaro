import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';

export interface ClientAuthRequest extends Request {
    client?: {
        id: string;
        fullName: string;
        phone: string;
        email: string | null;
        orgId: string;
    };
}

const JWT_SECRET = process.env.CLIENT_JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error(
        'FATAL: CLIENT_JWT_SECRET environment variable is not set. ' +
        'The server cannot start without a JWT secret. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    );
}

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshTokenRaw(): string {
    return crypto.randomBytes(48).toString('base64url');
}

export function signClientAccessToken(clientId: string): string {
    return jwt.sign({ clientId, type: 'access' }, JWT_SECRET!, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

/**
 * @deprecated Use signClientAccessToken + createRefreshToken instead.
 * Kept for backward compatibility during migration.
 */
export const signClientToken = (clientId: string): string => {
    return signClientAccessToken(clientId);
};

export async function createRefreshToken(clientId: string, familyId?: string): Promise<string> {
    const rawToken = generateRefreshTokenRaw();
    const tokenHash = hashToken(rawToken);
    const family = familyId || crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.clientRefreshToken.create({
        data: {
            clientId,
            tokenHash,
            familyId: family,
            expiresAt,
        },
    });

    return `${family}:${rawToken}`;
}

export async function rotateRefreshToken(rawCompoundToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    clientId: string;
} | null> {
    const colonIdx = rawCompoundToken.indexOf(':');
    if (colonIdx === -1) return null;

    const familyId = rawCompoundToken.substring(0, colonIdx);
    const rawToken = rawCompoundToken.substring(colonIdx + 1);
    if (!familyId || !rawToken) return null;

    const tokenHash = hashToken(rawToken);
    const now = new Date();

    // Atomic revocation: only one concurrent request can win this UPDATE.
    // The WHERE clause (isRevoked = false AND expiresAt > now) ensures exactly
    // one winner — the second concurrent request sees count=0 and falls through
    // to the reuse-detection branch below.
    const revoked = await prisma.clientRefreshToken.updateMany({
        where: { tokenHash, isRevoked: false, expiresAt: { gt: now } },
        data: { isRevoked: true },
    });

    if (revoked.count === 0) {
        // Could be: token doesn't exist, already expired, or was already revoked
        // (potential token reuse / replay attack). Fetch to distinguish.
        const storedToken = await prisma.clientRefreshToken.findUnique({
            where: { tokenHash },
        });

        if (storedToken?.isRevoked) {
            // Reuse detected — the token was already consumed. Revoke the entire
            // family to invalidate all sessions derived from this token tree.
            await prisma.clientRefreshToken.updateMany({
                where: { familyId: storedToken.familyId },
                data: { isRevoked: true },
            });
        }
        return null;
    }

    // Fetch the record we just revoked to read clientId and stored familyId.
    const storedToken = await prisma.clientRefreshToken.findUnique({
        where: { tokenHash },
    });

    // Defensive: shouldn't happen since we just updated it.
    if (!storedToken) return null;

    // Cross-check the familyId from the compound token against what's in the DB.
    // A mismatch indicates a forged or tampered token — revoke the entire family
    // the token actually belongs to, then reject.
    if (storedToken.familyId !== familyId) {
        await prisma.clientRefreshToken.updateMany({
            where: { familyId: storedToken.familyId },
            data: { isRevoked: true },
        });
        return null;
    }

    const newRefreshToken = await createRefreshToken(storedToken.clientId, storedToken.familyId);
    const accessToken = signClientAccessToken(storedToken.clientId);

    return {
        accessToken,
        refreshToken: newRefreshToken,
        clientId: storedToken.clientId,
    };
}

export async function revokeAllClientTokens(clientId: string): Promise<void> {
    await prisma.clientRefreshToken.updateMany({
        where: { clientId, isRevoked: false },
        data: { isRevoked: true },
    });
}

export const requireClientAuth = async (
    req: ClientAuthRequest,
    _res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return next(AppError.unauthorized('No token provided'));
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET!, { clockTolerance: 10 }) as { clientId: string; type?: string };

        // Accept both old tokens (no type) and new access tokens
        if (decoded.type && decoded.type !== 'access') {
            return next(AppError.unauthorized('Invalid token type'));
        }

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
            return next(AppError.unauthorized('Invalid or inactive client'));
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
        return next(AppError.unauthorized('Invalid or expired token'));
    }
};
