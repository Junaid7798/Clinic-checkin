import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { verifyOTP } from '@/lib/services/vonage';

const checkSchema = z.object({
    requestId: z.string().min(1, 'Request ID is required'),
    code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = checkSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        // DEV-MODE BYPASS: Accept "123456" or "000000" as a valid code in development
        if (process.env.NODE_ENV === 'development' && (parsed.data.code === '123456' || parsed.data.code === '000000')) {
            console.log(`[API /verify/check] DEV BYPASS: Accepting test code ${parsed.data.code}`);
            return NextResponse.json({ verified: true });
        }

        const result = await verifyOTP(parsed.data.requestId, parsed.data.code);
        return NextResponse.json({ verified: result.verified });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Verification failed';
        console.error('[API /verify/check] Error:', message);
        return NextResponse.json(
            { error: 'Verification failed. Please see the front desk.', code: 'VERIFICATION_FAILED' },
            { status: 400 }
        );
    }
}
