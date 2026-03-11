import crypto from 'crypto';

// Simple session-based admin auth using HMAC-signed tokens stored in cookies.
// No external JWT library needed — uses Node.js crypto.

const ALGORITHM = 'sha256';
const TOKEN_EXPIRY_HOURS = 8;

function getSecret(): string {
    return (
        process.env.ADMIN_SESSION_SECRET ||
        crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD || 'admin').digest('hex')
    );
}

export interface AdminSession {
    username: string;
    iat: number; // issued at (ms)
    exp: number; // expiry (ms)
}

/**
 * Create a signed session token for the admin user.
 */
export function createSessionToken(username: string): string {
    const session: AdminSession = {
        username,
        iat: Date.now(),
        exp: Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    };

    const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
    const signature = crypto
        .createHmac(ALGORITHM, getSecret())
        .update(payload)
        .digest('base64url');

    return `${payload}.${signature}`;
}

/**
 * Verify a session token. Returns the session if valid, null otherwise.
 */
export function verifySessionToken(token: string): AdminSession | null {
    try {
        const [payload, signature] = token.split('.');
        if (!payload || !signature) return null;

        const expectedSignature = crypto
            .createHmac(ALGORITHM, getSecret())
            .update(payload)
            .digest('base64url');

        // Constant-time comparison to prevent timing attacks
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return null;
        }

        const session: AdminSession = JSON.parse(
            Buffer.from(payload, 'base64url').toString('utf-8')
        );

        // Check expiry
        if (Date.now() > session.exp) {
            return null;
        }

        return session;
    } catch {
        return null;
    }
}

/**
 * Validate admin credentials against environment variables.
 */
export function validateCredentials(username: string, password: string): boolean {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

    // Constant-time comparison
    const userMatch =
        username.length === adminUser.length &&
        crypto.timingSafeEqual(Buffer.from(username), Buffer.from(adminUser));
    const passMatch =
        password.length === adminPass.length &&
        crypto.timingSafeEqual(Buffer.from(password), Buffer.from(adminPass));

    return userMatch && passMatch;
}

export const ADMIN_COOKIE_NAME = 'admin_session';
