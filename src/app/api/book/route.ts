import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { createAppointment } from '@/lib/services/google-calendar';

const bookSchema = z.object({
    patientName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1),
    startTime: z.string().min(1),
    reason: z.string().min(1),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = bookSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        const result = await createAppointment(parsed.data);

        return NextResponse.json({
            eventId: result.eventId,
            startTime: result.startTime,
            endTime: result.endTime,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not book appointment';
        console.error('[API /book] Error:', message);
        return NextResponse.json(
            { error: 'Could not book appointment. Please see the front desk.', code: 'BOOKING_ERROR' },
            { status: 500 }
        );
    }
}
