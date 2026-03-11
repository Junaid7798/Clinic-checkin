import { NextRequest, NextResponse } from 'next/server';
import { sendVoiceReminder } from '@/lib/services/vonage';
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

/**
 * Triggers a manual voice reminder call to a patient.
 */
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME);
        if (!sessionCookie || !verifySessionToken(sessionCookie.value)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { phone, patientName, appointmentTime } = await request.json();

        if (!phone || !patientName || !appointmentTime) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const result = await sendVoiceReminder(phone, patientName, appointmentTime);

        if (!result.success) {
            throw new Error('Call service failed');
        }

        return NextResponse.json({ success: true, message: 'Voice reminder sent.' });

    } catch (error) {
        console.error('[API /admin/reminders/voice] Error:', error);
        return NextResponse.json({ error: 'Failed to place call' }, { status: 500 });
    }
}
