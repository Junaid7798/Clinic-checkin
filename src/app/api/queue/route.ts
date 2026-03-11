import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const patientId = searchParams.get('patientId');

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Get all active check-ins today
        const activeCheckIns = await prisma.checkInLog.findMany({
            where: {
                check_in_time: { gte: startOfDay },
                status: 'WAITING',
            },
            orderBy: { check_in_time: 'asc' },
        });

        const totalWaiting = activeCheckIns.length;
        
        let position = -1;
        if (patientId) {
            position = activeCheckIns.findIndex((ci: any) => ci.patient_id === patientId) + 1;
        }

        // Estimate 15 mins per patient
        const averageWaitPerPatient = 15;
        const estimatedWaitTime = Math.max(0, (totalWaiting - 1) * averageWaitPerPatient);

        return NextResponse.json({
            totalWaiting,
            position,
            estimatedWaitTime,
        });

    } catch (error) {
        console.error('[API /queue] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch queue data' }, { status: 500 });
    }
}
