import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Services ────────────────────────────
const mockFindPatient = vi.fn();
const mockCreatePatient = vi.fn();
const mockUpdatePatientWithAudit = vi.fn();
const mockSheetsLookup = vi.fn();
const mockSheetsCreate = vi.fn();
const mockSheetsUpdate = vi.fn();

vi.mock('@/lib/services/patient-db', () => ({
    findPatient: (...args: unknown[]) => mockFindPatient(...args),
    createPatient: (...args: unknown[]) => mockCreatePatient(...args),
    updatePatientWithAudit: (...args: unknown[]) => mockUpdatePatientWithAudit(...args),
}));

vi.mock('@/lib/services/google-sheets', () => ({
    lookupPatient: (...args: unknown[]) => mockSheetsLookup(...args),
    createPatient: (...args: unknown[]) => mockSheetsCreate(...args),
    updatePatient: (...args: unknown[]) => mockSheetsUpdate(...args),
}));

// ─── Import route handler ────────────────────
import { POST } from '@/app/api/checkin/route';
import { NextRequest } from 'next/server';

function makeRequest(body: Record<string, unknown>) {
    return new NextRequest('http://localhost/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

const validBody = {
    firstName: 'John',
    lastName: 'Doe',
    dob: '1990-05-15',
    phone: '5551234567',
    email: 'john@example.com',
    reasonForVisit: 'Routine Eye Exam',
};

// ─── Tests ────────────────────────────────────
describe('POST /api/checkin', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates new patient in both DBs when not found', async () => {
        mockFindPatient.mockResolvedValue(null);
        mockCreatePatient.mockResolvedValue({ patientId: 'PAT-20260310-ABC123' });
        mockSheetsCreate.mockResolvedValue({ success: true });

        const res = await POST(makeRequest(validBody));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.isNew).toBe(true);
        expect(data.patientId).toBe('PAT-20260310-ABC123');
        expect(mockCreatePatient).toHaveBeenCalledOnce();
        expect(mockSheetsCreate).toHaveBeenCalledOnce();
    });

    it('updates existing patient with audit when changes detected', async () => {
        const existingPatient = {
            patient_id: 'PAT-EXISTING',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@example.com',
            phone: '9999999999',
            insurance_provider: 'Self-Pay',
        };

        mockFindPatient.mockResolvedValue(existingPatient);
        mockUpdatePatientWithAudit.mockResolvedValue({
            updated: true,
            changes: [{ field: 'phone', oldValue: '9999999999', newValue: '5551234567' }],
        });
        mockSheetsLookup.mockResolvedValue({ found: true, rowIndex: 2, data: {} });
        mockSheetsUpdate.mockResolvedValue({ success: true });

        const res = await POST(makeRequest(validBody));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.isNew).toBe(false);
        expect(data.changesDetected).toBe(true);
        expect(data.changes).toHaveLength(1);
        expect(data.changes[0].field).toBe('phone');
        expect(mockUpdatePatientWithAudit).toHaveBeenCalledOnce();
    });

    it('returns existing patient without update when no changes', async () => {
        const existingPatient = {
            patient_id: 'PAT-EXISTING',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@example.com',
            phone: '5551234567',
        };

        mockFindPatient.mockResolvedValue(existingPatient);
        mockUpdatePatientWithAudit.mockResolvedValue({ updated: false, changes: [] });

        const res = await POST(makeRequest(validBody));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.isNew).toBe(false);
        expect(data.changesDetected).toBe(false);
        expect(data.changes).toHaveLength(0);
        // Should NOT call sheets update since no changes
        expect(mockSheetsUpdate).not.toHaveBeenCalled();
    });

    it('rejects invalid email', async () => {
        const res = await POST(makeRequest({ ...validBody, email: 'not-an-email' }));
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects short first name', async () => {
        const res = await POST(makeRequest({ ...validBody, firstName: 'J' }));
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects missing reason', async () => {
        const res = await POST(makeRequest({ ...validBody, reasonForVisit: '' }));
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('returns 500 with safe error on DB failure', async () => {
        mockFindPatient.mockRejectedValue(new Error('DB connection refused'));

        const res = await POST(makeRequest(validBody));
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.code).toBe('CHECKIN_ERROR');
        expect(data.error).toContain('front desk');
        // Should NOT expose internal error
        expect(data.error).not.toContain('DB connection');
    });

    it('succeeds even if Google Sheets create fails', async () => {
        mockFindPatient.mockResolvedValue(null);
        mockCreatePatient.mockResolvedValue({ patientId: 'PAT-NEW' });
        mockSheetsCreate.mockRejectedValue(new Error('Sheets API down'));

        const res = await POST(makeRequest(validBody));
        const data = await res.json();

        // Primary DB succeeded, so request should still succeed
        expect(res.status).toBe(200);
        expect(data.patientId).toBe('PAT-NEW');
        expect(data.isNew).toBe(true);
    });
});
