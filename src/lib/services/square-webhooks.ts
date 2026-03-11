import crypto from 'crypto';

/**
 * Verifies the integrity of a Square webhook request.
 * 
 * @param body The raw request body as a string.
 * @param signature The value of the 'x-square-hmacsha256-signature' header.
 * @param signatureKey Your Square webhook signature key.
 * @param notificationUrl The full URL that Square is sending the notification to.
 * @returns true if the signature is valid, false otherwise.
 */
export function verifySquareSignature(
    body: string,
    signature: string,
    signatureKey: string,
    notificationUrl: string
): boolean {
    if (!signature || !signatureKey) return false;

    // The signature base is the URL + the raw body
    const signatureBase = notificationUrl + body;
    const hmac = crypto.createHmac('sha256', signatureKey);
    hmac.update(signatureBase);
    const expectedSignature = hmac.digest('base64');

    return expectedSignature === signature;
}

export interface SquareEvent {
    merchant_id: string;
    type: string;
    event_id: string;
    created_at: string;
    data: {
        type: string;
        id: string;
        object: any;
    };
}
