import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { getAvailableSlots } from '@/lib/services/google-calendar';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || undefined;

        const result = await getAvailableSlots(date);
        return NextResponse.json(result);
    } catch (error) {
        console.error('[API /slots] Error:', error);

        // Fallback: generate all slots without busy-time filtering
        const openHour = parseInt(process.env.CLINIC_OPEN_HOUR || '9', 10);
        const closeHour = parseInt(process.env.CLINIC_CLOSE_HOUR || '17', 10);
        const duration = parseInt(process.env.APPOINTMENT_DURATION_MINUTES || '30', 10);
        const today = new Date().toISOString().split('T')[0];

        const slots = [];
        for (let hour = openHour; hour < closeHour; hour++) {
            for (let min = 0; min < 60; min += duration) {
                const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayStr = `${displayHour}:${min.toString().padStart(2, '0')} ${ampm}`;
                slots.push({ time: timeStr, display: displayStr, available: true });
            }
        }

        return NextResponse.json({ date: today, slots, reason: 'FALLBACK' }, { status: 502 });
    }
}
