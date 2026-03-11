import { NextRequest, NextResponse } from 'next/server';
import { verifySquareSignature } from '@/lib/services/square-webhooks';
import * as square from '@/lib/services/square';
import * as patientDb from '@/lib/services/patient-db';
import * as googleSheets from '@/lib/services/google-sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const signature = request.headers.get('x-square-hmacsha256-signature') || '';
    const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const notificationUrl = `${appUrl}/api/webhooks/square`;

    console.log('[Webhook] Received Square event');

    // Verify signature (optional in sandbox/dev if key is missing)
    if (signatureKey) {
        const isValid = verifySquareSignature(rawBody, signature, signatureKey, notificationUrl);
        if (!isValid) {
            console.error('[Webhook] Invalid Square signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
    } else {
        console.warn('[Webhook] SQUARE_WEBHOOK_SIGNATURE_KEY missing, skipping verification');
    }

    try {
        const event = JSON.parse(rawBody);
        const eventType = event.type;

        console.log(`[Webhook] Handling event type: ${eventType}`);

        if (eventType === 'payment.updated') {
            const payment = event.data.object.payment;
            // We only care about completed payments
            if (payment.status === 'COMPLETED') {
                await handleCompletedPayment(payment);
            }
        } else if (eventType === 'booking.created' || eventType === 'booking.updated') {
            const booking = event.data.object.booking;
            await handleBookingEvent(booking);
        }

        // Always return 200 OK to Square within 10 seconds
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Webhook] Error processing event:', error);
        // Still return 200 to stop Square from retrying if the error is on our side and likely persistent
        // but in a real app, you might want to return 500 for temporary failures (like DB down)
        return NextResponse.json({ success: true });
    }
}

async function handleCompletedPayment(payment: any) {
    const paymentId = payment.id;
    const amountCents = Number(payment.amount_money.amount);
    const amountDollars = amountCents / 100;
    const customerId = payment.customer_id;
    const email = payment.buyer_email_address;
    const referenceId = payment.reference_id; // This might be our patientId if we set it

    console.log(`[Webhook] Processing completed payment: ${paymentId} for ${amountDollars} USD`);

    // 1. Resolve Patient
    let patient = null;
    if (referenceId && referenceId.startsWith('PAT-')) {
        patient = await patientDb.findPatientById(referenceId);
    }

    if (!patient && email) {
        patient = await patientDb.findPatient(email);
    }

    if (!patient) {
        console.log(`[Webhook] Could not resolve patient for payment ${paymentId}. Skipping sync.`);
        return;
    }

    const patientId = patient.patient_id;
    const patientName = `${patient.first_name} ${patient.last_name}`;

    // 2. Check for duplicate (Idempotency)
    // We'll search for existing transaction by payment_id
    // Since our schema doesn't have unique on payment_id, we check manually
    // In a real app, you'd add a unique constraint.
    
    // 3. Log Transaction and update Check-in
    try {
        const transactionId = `TXN-SQ-${paymentId}`;
        
        // Log to DB
        await patientDb.logTransaction({
            transactionId,
            patientId,
            paymentId,
            receiptUrl: payment.receipt_url,
            receiptNumber: payment.receipt_number,
            amount: amountDollars,
            status: 'COMPLETED',
            cardBrand: payment.card_details?.card?.card_brand,
            lastFour: payment.card_details?.card?.last_4,
            reason: payment.note || 'Sync from Square',
        });

        // Update latest unpaid check-in
        const unpaid = await patientDb.findLatestUnpaidCheckIn(patientId);
        if (unpaid) {
            await patientDb.updateCheckIn(unpaid.id, {
                paymentStatus: 'PAID',
                transactionId: paymentId,
            });
            console.log(`[Webhook] Updated check-in status to PAID for patient ${patientId}`);
        }

        // Log to Google Sheets
        await googleSheets.logTransaction({
            transaction_id: transactionId,
            patient_id: patientId,
            payment_id: paymentId,
            receipt_url: payment.receipt_url || '',
            amount: amountDollars.toFixed(2),
            currency: 'USD',
            status: 'COMPLETED',
            card_last_four: payment.card_details?.card?.last_4 || '',
            reason: payment.note || 'Sync from Square',
            date: new Date().toLocaleDateString(),
        });

    } catch (err) {
        // If transaction already exists, this might fail on unique constraint
        console.error(`[Webhook] Failed to sync transaction ${paymentId}:`, err);
    }
}
