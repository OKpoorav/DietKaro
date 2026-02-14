import { Request, Response, NextFunction } from 'express';

/**
 * Add deprecation headers to responses once a newer API version is available.
 * Follows the IETF "Deprecation" header draft standard.
 *
 * Usage (when ready to sunset v1):
 *   v1.use(deprecationWarning('2027-06-01'));
 */
export function deprecationWarning(sunsetDate: string) {
    return (_req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', sunsetDate);
        res.setHeader('Link', '</api/v2>; rel="successor-version"');
        next();
    };
}
