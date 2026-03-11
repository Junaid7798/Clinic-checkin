import { SquareClient, SquareEnvironment } from 'square';
import crypto from 'crypto';

// ─── Types ────────────────────────────────────
export interface ProcessPaymentParams {
    sourceId: string;
    amountCents: number;
    email: string;
    patientName: string;
    patientId: string;
    reason: string;
}

export interface PaymentResult {
    paymentId: string;
    receiptUrl: string;
    receiptNumber: string;
    status: string;
    cardBrand: string;
    lastFour: string;
}

// ─── Square Client ────────────────────────────
function getSquareClient() {
    const environment =
        process.env.SQUARE_ENVIRONMENT === 'production'
            ? SquareEnvironment.Production
            : SquareEnvironment.Sandbox;

    return new SquareClient({
        token: process.env.SQUARE_ACCESS_TOKEN!,
        environment,
    });
}

// ─── Process Payment ──────────────────────────
export async function processPayment(params: ProcessPaymentParams): Promise<PaymentResult> {
    try {
        const client = getSquareClient();

        const response = await client.payments.create({
            sourceId: params.sourceId,
            idempotencyKey: crypto.randomUUID(),
            amountMoney: {
                amount: BigInt(params.amountCents),
                currency: 'USD',
            },
            locationId: process.env.SQUARE_LOCATION_ID!,
            autocomplete: true,
            note: `Eye Care Visit - ${params.reason} - ${params.patientName}`,
            referenceId: params.patientId,
            buyerEmailAddress: params.email,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payment = response as any;
        if (!payment) {
            throw new Error('No payment object in Square response');
        }

        return {
            paymentId: payment.id || payment.payment?.id || '',
            receiptUrl: payment.receiptUrl || payment.payment?.receiptUrl || '',
            receiptNumber: payment.receiptNumber || payment.payment?.receiptNumber || '',
            status: payment.status || payment.payment?.status || 'UNKNOWN',
            cardBrand: payment.cardDetails?.card?.cardBrand || payment.payment?.cardDetails?.card?.cardBrand || 'UNKNOWN',
            lastFour: payment.cardDetails?.card?.last4 || payment.payment?.cardDetails?.card?.last4 || '****',
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error processing payment';
        console.error('[Square] processPayment error:', message);
        throw new Error(`Payment processing failed: ${message}`);
    }
}

// ─── Get Customer ─────────────────────────────
export async function getCustomer(customerId: string): Promise<{ name: string; phone: string; email: string } | null> {
    try {
        const client = getSquareClient();
        const response = await client.customers.get({ customerId });
        const customer = response.customer;
        if (!customer) return null;

        return {
            name: `${customer.givenName || ''} ${customer.familyName || ''}`.trim() || 'Valued Customer',
            phone: customer.phoneNumber || '',
            email: customer.emailAddress || '',
        };
    } catch (error) {
        console.error('[Square] getCustomer error:', error);
        return null;
    }
}

// ─── Get Today's Bookings ─────────────────────
export async function getTodayBookings(date?: string): Promise<any[]> {
    try {
        const client = getSquareClient();

        const targetDate = date ? new Date(date) : new Date();
        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

        const response = await client.bookings.list({
            locationId: process.env.SQUARE_LOCATION_ID,
            startAtMin: startOfDay.toISOString(),
            startAtMax: endOfDay.toISOString(),
        });

        const bookings: any[] = [];
        for await (const booking of response) {
            // Enrich with customer data if available
            if (booking.customerId) {
                const customer = await getCustomer(booking.customerId);
                if (customer) {
                    (booking as any).customerName = customer.name;
                    (booking as any).customerPhone = customer.phone;
                    (booking as any).customerEmail = customer.email;
                }
            }
            bookings.push(booking);
        }
        return bookings;
    } catch (error) {
        console.error('[Square] getTodayBookings error:', error);
        return [];
    }
}

// ─── Cancel Booking ───────────────────────────
export async function cancelBooking(bookingId: string): Promise<void> {
    try {
        const client = getSquareClient();
        await client.bookings.cancel({
            bookingId,
            idempotencyKey: crypto.randomUUID(),
        });
    } catch (error) {
        console.error('[Square] cancelBooking error:', error);
        throw error;
    }
}
