import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { getTodayAppointments } from '@/lib/services/google-calendar';
import { getTodayBookings } from '@/lib/services/square';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');
        const date = searchParams.get('date') || undefined;

        if (!email) {
            return NextResponse.json(
                { error: 'Email is required', code: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        // Check Google Calendar
        const calendarResult = await getTodayAppointments(email, date);
        if (calendarResult.found && calendarResult.appointment) {
            return NextResponse.json({
                found: true,
                appointment: calendarResult.appointment,
            });
        }

        // Check Square Bookings
        try {
            const bookings = await getTodayBookings();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const matchingBooking = bookings.find((b: any) => {
                const customerEmail = (b.customerEmail || b.customerNote || '').toLowerCase().trim();
                return customerEmail === email.toLowerCase().trim() || customerEmail.includes(email.toLowerCase().trim());
            });

            if (matchingBooking) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const booking = matchingBooking as any;
                return NextResponse.json({
                    found: true,
                    appointment: {
                        source: 'square-bookings',
                        title: booking.appointmentSegments?.[0]?.serviceVariationId || 'Appointment',
                        startTime: booking.startAt || '',
                        endTime: booking.startAt || '',
                        location: 'Clinic',
                    },
                });
            }
        } catch (squareError) {
            console.error('[API /appointments] Square check failed (non-critical):', squareError);
        }

        return NextResponse.json({ found: false, reason: 'NOT_FOUND' });
    } catch (error) {
        console.error('[API /appointments] Error:', error);
        // Graceful degradation — don't block check-in, but signal service issue
        return NextResponse.json({ found: false, reason: 'SERVICE_ERROR' }, { status: 502 });
    }
}
