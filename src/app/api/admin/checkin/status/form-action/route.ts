import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifySessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME);
        if (!sessionCookie || !verifySessionToken(sessionCookie.value)) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const formData = await request.formData();
        const checkInId = formData.get('checkInId') as string;
        const status = formData.get('status') as string;

        if (!checkInId || !status) {
            return new NextResponse('Missing parameters', { status: 400 });
        }

        await prisma.checkInLog.update({
            where: { id: parseInt(checkInId) },
            data: { status }
        });

        // Redirect back to admin page
        return NextResponse.redirect(new URL('/admin', request.nextUrl.origin), {
            status: 303 // See Other
        });

    } catch (error) {
        console.error('[POST /api/admin/checkin/status/form-action] Error:', error);
        return new NextResponse('Error updating status', { status: 500 });
    }
}
