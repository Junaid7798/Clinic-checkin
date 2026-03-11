import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { z } from 'zod';
import * as square from '@/lib/services/square';
import * as patientDb from '@/lib/services/patient-db';
import * as googleSheets from '@/lib/services/google-sheets';
import * as vonage from '@/lib/services/vonage';
import * as email from '@/lib/services/email';

const paymentSchema = z.object({
    sourceId: z.string().min(1, 'Payment source is required'),
    amount: z.number().int().min(1, 'Amount must be positive'),
    patientEmail: z.string().email(),
    patientName: z.string().min(1),
    patientId: z.string().min(1),
    patientPhone: z.string().optional(),
    reason: z.string().min(1),
    appointmentTime: z.string().optional(),
});

function generateTransactionId(): string {
    const now = new Date();
    const timestamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
    ].join('');
    return `TXN-${timestamp}`;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = paymentSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        const data = parsed.data;

        // Step 1: Process payment via Square (MUST complete before responding)
        let paymentResult: square.PaymentResult;
        try {
            paymentResult = await square.processPayment({
                sourceId: data.sourceId,
                amountCents: data.amount,
                email: data.patientEmail,
                patientName: data.patientName,
                patientId: data.patientId,
                reason: data.reason,
            });
        } catch (paymentError) {
            const errorMessage = paymentError instanceof Error ? paymentError.message : 'Payment failed';
            console.error('[API /payment] Square payment failed:', errorMessage);

            // Alert front desk (non-blocking)
            email.sendFrontDeskAlert({
                patientName: data.patientName,
                email: data.patientEmail,
                phone: data.patientPhone || '',
                reason: data.reason,
                error: errorMessage,
            }).catch(console.error);

            return NextResponse.json(
                { success: false, error: 'Payment could not be processed. Please see the front desk.', code: 'PAYMENT_FAILED' },
                { status: 400 }
            );
        }

        // Step 2: Post-payment actions (non-critical — use Promise.allSettled)
        const transactionId = generateTransactionId();
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const amountDollars = data.amount / 100;

        // Fire all non-critical actions in parallel
        const postPaymentActions = Promise.allSettled([
            // Log transaction to PostgreSQL
            patientDb.logTransaction({
                transactionId,
                patientId: data.patientId,
                paymentId: paymentResult.paymentId,
                receiptUrl: paymentResult.receiptUrl,
                receiptNumber: paymentResult.receiptNumber,
                amount: amountDollars,
                currency: 'USD',
                status: paymentResult.status,
                cardBrand: paymentResult.cardBrand,
                lastFour: paymentResult.lastFour,
                reason: data.reason,
            }),

            // Log transaction to Google Sheets
            googleSheets.logTransaction({
                transaction_id: transactionId,
                patient_id: data.patientId,
                payment_id: paymentResult.paymentId,
                receipt_url: paymentResult.receiptUrl,
                amount: amountDollars.toFixed(2),
                currency: 'USD',
                status: paymentResult.status,
                card_last_four: paymentResult.lastFour,
                reason: data.reason,
                date: dateStr,
            }),

            // Send SMS receipt
            data.patientPhone
                ? vonage.sendSMS(
                    data.patientPhone,
                    `✅ ${process.env.CLINIC_NAME || 'Clinic'}: Payment of $${amountDollars.toFixed(2)} confirmed. Transaction: ${transactionId}. Receipt: ${paymentResult.receiptUrl}`
                )
                : Promise.resolve(),

            // Send email receipt
            email.sendReceiptEmail({
                to: data.patientEmail,
                patientName: data.patientName,
                amount: data.amount,
                currency: 'USD',
                transactionId,
                paymentId: paymentResult.paymentId,
                receiptUrl: paymentResult.receiptUrl,
                cardBrand: paymentResult.cardBrand,
                lastFour: paymentResult.lastFour,
                reason: data.reason,
                date: dateStr,
                appointmentTime: data.appointmentTime,
            }),

            // Log check-in to PostgreSQL (Update existing if possible)
            (async () => {
                try {
                    const unpaid = await patientDb.findLatestUnpaidCheckIn(data.patientId);
                    if (unpaid) {
                        await patientDb.updateCheckIn(unpaid.id, {
                            appointmentConfirmed: true,
                            paymentStatus: 'PAID',
                            transactionId: paymentResult.paymentId,
                            reasonForVisit: data.reason,
                        });
                    } else {
                        await patientDb.logCheckIn({
                            patientId: data.patientId,
                            appointmentConfirmed: true,
                            paymentStatus: 'PAID',
                            transactionId: paymentResult.paymentId,
                            reasonForVisit: data.reason,
                        });
                    }
                } catch (err) {
                    console.error('[API /payment] Failed to update/log check-in:', err);
                }
            })(),

            // Log check-in to Google Sheets
            googleSheets.logCheckIn({
                patient_id: data.patientId,
                patient_name: data.patientName,
                check_in_time: now.toISOString(),
                appointment_found: true,
                slot_booked: '',
                payment_status: 'PAID',
                transaction_id: transactionId,
                reason: data.reason,
            }),
        ]);

        // Don't await post-payment actions for the response — but log failures
        postPaymentActions.then((results) => {
            const failures = results.filter((r) => r.status === 'rejected');
            if (failures.length > 0) {
                console.error('[API /payment] Some post-payment actions failed:', failures);
            }
        });

        return NextResponse.json({
            success: true,
            paymentId: paymentResult.paymentId,
            receiptUrl: paymentResult.receiptUrl,
            transactionId,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API /payment] Error:', message);
        return NextResponse.json(
            { success: false, error: 'An unexpected error occurred. Please see the front desk.', code: 'PAYMENT_FAILED' },
            { status: 500 }
        );
    }
}
