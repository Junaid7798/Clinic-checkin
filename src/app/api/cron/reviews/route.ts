import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { sendReviewRequestEmail } from '@/lib/services/email';

export async function GET(request: Request) {
    // Vercel Cron security check: Ensure the request comes from Vercel
    const authHeader = request.headers.get('authorization');
    if (
        process.env.NODE_ENV !== 'development' &&
        authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('[Cron] Starting review requests scan...');
        
        // Find CheckIns older than 24 hours where the patient has NEVER been requested for a review
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const eligibleCheckIns = await prisma.checkInLog.findMany({
            where: {
                check_in_time: { lt: twentyFourHoursAgo },
                patient: { is: { review_requested_at: null } },
            },
            include: { patient: true },
            take: 50, // Process in batches to prevent server timeouts
        });

        if (eligibleCheckIns.length === 0) {
            return NextResponse.json({ message: 'No pending review requests.' });
        }

        let sentCount = 0;
        let pErrors = 0;

        // Dedup patients so we only email them once across all historical check-ins
        const uniquePatients = new Map<string, typeof eligibleCheckIns[0]['patient']>();
        for (const log of eligibleCheckIns) {
            if (!uniquePatients.has(log.patient_id)) {
                uniquePatients.set(log.patient_id, log.patient);
            }
        }

        for (const [patientId, patient] of uniquePatients.entries()) {
            try {
                // Send email
                const sent = await sendReviewRequestEmail(patient.first_name, patient.email);
                
                if (sent) {
                    // Mark as requested
                    await prisma.patient.update({
                        where: { patient_id: patientId },
                        data: { review_requested_at: new Date() }
                    });
                    sentCount++;
                } else {
                    pErrors++;
                }
            } catch (err) {
                console.error(`[Cron] Error processing review for ${patientId}:`, err);
                pErrors++;
            }
        }

        return NextResponse.json({ 
            success: true, 
            processed: uniquePatients.size, 
            sent: sentCount, 
            errors: pErrors 
        });

    } catch (error: any) {
        console.error('[API /cron/reviews] Fatal Error:', error);
        return NextResponse.json({ error: 'Cron execution failed', details: error.message, stack: error.stack }, { status: 500 });
    }
}
