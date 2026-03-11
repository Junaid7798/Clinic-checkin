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

        // Support both JSON and FormData for AdminActionButton
        let checkInId: string;
        const contentType = request.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
            const body = await request.json();
            checkInId = body.checkInId;
        } else {
            const formData = await request.formData();
            checkInId = formData.get('checkInId') as string;
        }

        if (!checkInId) {
            return new NextResponse('Missing checkInId', { status: 400 });
        }

        await prisma.checkInLog.delete({
            where: { id: parseInt(checkInId) }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[API /admin/checkin/delete] Error:', error);
        return new NextResponse('Failed to delete check-in log', { status: 500 });
    }
}
