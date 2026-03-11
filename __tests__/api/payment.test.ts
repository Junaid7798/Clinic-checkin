import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Services ────────────────────────────
const mockProcessPayment = vi.fn();
const mockLogTransaction = vi.fn();
const mockLogCheckIn = vi.fn();
const mockSheetsLogTransaction = vi.fn();
const mockSheetsLogCheckIn = vi.fn();
const mockSendSMS = vi.fn();
const mockSendReceiptEmail = vi.fn();
const mockSendFrontDeskAlert = vi.fn();

vi.mock('@/lib/services/square', () => ({
    processPayment: (...args: unknown[]) => mockProcessPayment(...args),
}));

vi.mock('@/lib/services/patient-db', () => ({
    logTransaction: (...args: unknown[]) => mockLogTransaction(...args),
    logCheckIn: (...args: unknown[]) => mockLogCheckIn(...args),
}));

vi.mock('@/lib/services/google-sheets', () => ({
    logTransaction: (...args: unknown[]) => mockSheetsLogTransaction(...args),
    logCheckIn: (...args: unknown[]) => mockSheetsLogCheckIn(...args),
}));

vi.mock('@/lib/services/vonage', () => ({
    sendSMS: (...args: unknown[]) => mockSendSMS(...args),
}));

vi.mock('@/lib/services/email', () => ({
    sendReceiptEmail: (...args: unknown[]) => mockSendReceiptEmail(...args),
    sendFrontDeskAlert: (...args: unknown[]) => mockSendFrontDeskAlert(...args),
}));

// ─── Import route handler ────────────────────
import { POST } from '@/app/api/payment/route';
import { NextRequest } from 'next/server';

function makeRequest(body: Record<string, unknown>) {
    return new NextRequest('http://localhost/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

const validBody = {
    sourceId: 'cnon:card-nonce-ok',
    amount: 5000,
    patientEmail: 'patient@example.com',
    patientName: 'John Doe',
    patientId: 'PAT-123',
    patientPhone: '+15551234567',
    reason: 'Routine Eye Exam',
};

const mockPaymentResult = {
    paymentId: 'sq-pay-123',
    receiptUrl: 'https://squareup.com/receipt/123',
    receiptNumber: 'RCP-001',
    status: 'COMPLETED',
    cardBrand: 'VISA',
    lastFour: '4012',
};

// ─── Tests ────────────────────────────────────
describe('POST /api/payment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLogTransaction.mockResolvedValue(undefined);
        mockLogCheckIn.mockResolvedValue(undefined);
        mockSheetsLogTransaction.mockResolvedValue({ success: true });
        mockSheetsLogCheckIn.mockResolvedValue({ success: true });
        mockSendSMS.mockResolvedValue({ success: true });
        mockSendReceiptEmail.mockResolvedValue({ success: true });
    });

    it('processes payment and triggers all post-payment actions', async () => {
        mockProcessPayment.mockResolvedValue(mockPaymentResult);

        const res = await POST(makeRequest(validBody));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.paymentId).toBe('sq-pay-123');
        expect(data.receiptUrl).toContain('squareup.com');
        expect(data.transactionId).toMatch(/^TXN-/);
        expect(mockProcessPayment).toHaveBeenCalledOnce();
    });

    it('returns failure and alerts front desk when Square payment fails', async () => {
        mockProcessPayment.mockRejectedValue(new Error('Card declined'));
        mockSendFrontDeskAlert.mockResolvedValue(undefined);

        const res = await POST(makeRequest(validBody));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.code).toBe('PAYMENT_FAILED');
        expect(data.error).toContain('front desk');
        // Should alert front desk
        expect(mockSendFrontDeskAlert).toHaveBeenCalledOnce();
    });

    it('still returns success even if SMS fails (non-critical)', async () => {
        mockProcessPayment.mockResolvedValue(mockPaymentResult);
        mockSendSMS.mockRejectedValue(new Error('SMS service down'));

        const res = await POST(makeRequest(validBody));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
    });

    it('still returns success even if email fails (non-critical)', async () => {
        mockProcessPayment.mockResolvedValue(mockPaymentResult);
        mockSendReceiptEmail.mockRejectedValue(new Error('Email service down'));

        const res = await POST(makeRequest(validBody));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
    });

    it('rejects missing sourceId', async () => {
        const res = await POST(makeRequest({ ...validBody, sourceId: '' }));
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects zero amount', async () => {
        const res = await POST(makeRequest({ ...validBody, amount: 0 }));
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects invalid email', async () => {
        const res = await POST(makeRequest({ ...validBody, patientEmail: 'bad-email' }));
        expect(res.status).toBeGreaterThanOrEqual(400);
    });
});
