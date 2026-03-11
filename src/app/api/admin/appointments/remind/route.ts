import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { cookies } from 'next/headers';
import { sendVoiceReminder } from '@/lib/services/vonage';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME);
        if (!sessionCookie || !verifySessionToken(sessionCookie.value)) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const formData = await request.formData();
        const phone = formData.get('phone') as string;
        const patientName = formData.get('patientName') as string;
        const appointmentTime = formData.get('appointmentTime') as string;

        if (!phone || !patientName || !appointmentTime) {
            return new NextResponse('Missing parameters', { status: 400 });
        }

        const result = await sendVoiceReminder(phone, patientName, appointmentTime);

        if (!result.success) {
            return new NextResponse('Failed to send reminder', { status: 500 });
        }

        // Redirect back to admin page
        return NextResponse.redirect(new URL('/admin', request.nextUrl.origin), {
            status: 303 // See Other
        });

    } catch (error) {
        console.error('[POST /api/admin/appointments/remind] Error:', error);
        return new NextResponse('Error sending reminder', { status: 500 });
    }
}
