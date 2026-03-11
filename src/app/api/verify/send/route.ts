import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { sendOTP } from '@/lib/services/vonage';
import { rateLimit } from '@/lib/rate-limit';

const sendSchema = z.object({
    phone: z.string().regex(/^\+?\d{10,15}$/, 'Phone must be 10-15 digits'),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = sendSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        // Normalize phone: strip non-digits, ensure starts with country code
        let phone = parsed.data.phone.replace(/\D/g, '');
        if (phone.length === 10) {
            phone = '1' + phone; // Assume US
        }
        if (!phone.startsWith('+')) {
            phone = '+' + phone;
        }

        // Rate limit by Phone Number (Max 3 requests per 5 minutes)
        if (!rateLimit(phone, 3, 5 * 60 * 1000)) {
            console.warn(`[API /verify/send] Rate limit exceeded for phone: ${phone}`);
            return NextResponse.json(
                { error: 'Too many requests. Please wait a moment and try again.', code: 'RATE_LIMIT_EXCEEDED' },
                { status: 429 }
            );
        }

        // Optional: Also rate limit by IP
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        if (ip !== 'unknown' && !rateLimit(`ip_${ip}`, 10, 5 * 60 * 1000)) {
            console.warn(`[API /verify/send] Rate limit exceeded for IP: ${ip}`);
            return NextResponse.json(
                { error: 'Too many requests from this device. Please wait.', code: 'RATE_LIMIT_EXCEEDED' },
                { status: 429 }
            );
        }

        const result = await sendOTP(phone);
        return NextResponse.json({ requestId: result.requestId });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send verification code';
        console.error('[API /verify/send] Error:', message);
        return NextResponse.json(
            { error: 'Unable to send verification code. Please see the front desk.', code: 'VONAGE_ERROR' },
            { status: 500 }
        );
    }
}
