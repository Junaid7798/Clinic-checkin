export const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

/**
 * Simple in-memory rate limiter
 * @param identifier The key (e.g., IP address or phone number)
 * @param limit Maximum number of requests allowed in the window
 * @param windowMs Time window in milliseconds
 * @returns boolean true if under the limit, false if limit exceeded
 */
export function rateLimit(identifier: string, limit: number = 3, windowMs: number = 60000): boolean {
    const now = Date.now();
    let record = rateLimitMap.get(identifier);
    
    if (!record || now - record.lastReset > windowMs) {
        record = { count: 0, lastReset: now };
    }
    
    record.count++;
    rateLimitMap.set(identifier, record);
    
    return record.count <= limit;
}
