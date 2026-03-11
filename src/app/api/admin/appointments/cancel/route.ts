import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { cookies } from 'next/headers';
import { deleteAppointment } from '@/lib/services/google-calendar';
import { cancelBooking } from '@/lib/services/square';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME);
        if (!sessionCookie || !verifySessionToken(sessionCookie.value)) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const formData = await request.formData();
        const eventId = formData.get('eventId') as string;
        const source = formData.get('source') as string;

        if (!eventId || !source) {
            return new NextResponse('Missing parameters', { status: 400 });
        }

        if (source === 'google-calendar') {
            await deleteAppointment(eventId);
        } else if (source === 'square-bookings') {
            await cancelBooking(eventId);
        } else {
            return new NextResponse('Invalid source', { status: 400 });
        }

        // Redirect back to admin page
        return NextResponse.redirect(new URL('/admin', request.nextUrl.origin), {
            status: 303 // See Other
        });

    } catch (error) {
        console.error('[POST /api/admin/appointments/cancel] Error:', error);
        return new NextResponse('Error canceling appointment', { status: 500 });
    }
}
