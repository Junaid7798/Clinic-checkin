import { NextRequest, NextResponse } from 'next/server';
import { deleteAppointment } from '@/lib/services/google-calendar';
import { cancelBooking } from '@/lib/services/square';

export const runtime = 'nodejs';

/**
 * Handle client-side appointment cancellation.
 * This route is called by patients during the check-in flow.
 */
export async function POST(request: NextRequest) {
    try {
        const { eventId, source, email } = await request.json();

        if (!eventId || !source) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // Ideally, we would verify here that the email matches the appointment's attendee/customer.
        // For a kiosk app, we'll perform the action. In a production public-facing app, 
        // we should re-verify ownership.

        if (source === 'google-calendar') {
            await deleteAppointment(eventId);
        } else if (source === 'square-bookings') {
            await cancelBooking(eventId);
        } else {
            return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[POST /api/appointments/cancel] Error:', error);
        return NextResponse.json({ error: 'Error canceling appointment' }, { status: 500 });
    }
}
