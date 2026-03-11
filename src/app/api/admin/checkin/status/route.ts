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
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { checkInId, status } = await request.json();

        if (!checkInId || !status) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        await prisma.checkInLog.update({
            where: { id: parseInt(checkInId) },
            data: { status }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[API /admin/checkin/status] Error:', error);
        return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }
}
