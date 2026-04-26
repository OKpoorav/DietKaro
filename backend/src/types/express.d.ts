// Augment Express request with our custom fields.
declare global {
    namespace Express {
        interface Request {
            /** Raw request body (utf8) — populated only for /api/v1/webhooks/* routes. */
            rawBody?: string;
        }
    }
}

export {};
