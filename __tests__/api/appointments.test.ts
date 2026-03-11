import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Services ────────────────────────────
const mockGetTodayAppointments = vi.fn();
const mockGetTodayBookings = vi.fn();

vi.mock('@/lib/services/google-calendar', () => ({
    getTodayAppointments: (...args: unknown[]) => mockGetTodayAppointments(...args),
}));

vi.mock('@/lib/services/square', () => ({
    getTodayBookings: (...args: unknown[]) => mockGetTodayBookings(...args),
}));

// ─── Import route handler ────────────────────
import { GET } from '@/app/api/appointments/route';
import { NextRequest } from 'next/server';

function makeRequest(email: string, date?: string) {
    const url = new URL('http://localhost/api/appointments');
    url.searchParams.set('email', email);
    if (date) url.searchParams.set('date', date);
    return new NextRequest(url);
}

// ─── Tests ────────────────────────────────────
describe('GET /api/appointments', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetTodayBookings.mockResolvedValue([]);
    });

    it('returns appointment when found in Google Calendar', async () => {
        mockGetTodayAppointments.mockResolvedValue({
            found: true,
            appointment: {
                source: 'google-calendar',
                title: 'Eye Exam',
                startTime: '2026-03-10T14:00:00',
                endTime: '2026-03-10T14:30:00',
                location: 'Eye Care Clinic',
                eventId: 'evt-123',
            },
        });

        const res = await GET(makeRequest('patient@example.com'));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.found).toBe(true);
        expect(data.appointment.source).toBe('google-calendar');
        expect(data.appointment.title).toBe('Eye Exam');
    });

    it('returns found: false when no appointment in either source', async () => {
        mockGetTodayAppointments.mockResolvedValue({ found: false, appointment: null });
        mockGetTodayBookings.mockResolvedValue([]);

        const res = await GET(makeRequest('patient@example.com'));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.found).toBe(false);
    });

    it('gracefully degrades when Google Calendar is down', async () => {
        mockGetTodayAppointments.mockRejectedValue(new Error('Google Calendar API error'));
        mockGetTodayBookings.mockResolvedValue([]);

        const res = await GET(makeRequest('patient@example.com'));
        const data = await res.json();

        // Should degrade gracefully and signal service error
        expect(res.status).toBe(502);
        expect(data.found).toBe(false);
        expect(data.reason).toBe('SERVICE_ERROR');
    });

    it('gracefully degrades when Square Bookings is down', async () => {
        mockGetTodayAppointments.mockResolvedValue({ found: false, appointment: null });
        mockGetTodayBookings.mockRejectedValue(new Error('Square API error'));

        const res = await GET(makeRequest('patient@example.com'));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.found).toBe(false);
    });

    it('returns 400 when email is missing', async () => {
        const url = new URL('http://localhost/api/appointments');
        const req = new NextRequest(url);
        const res = await GET(req);

        expect(res.status).toBe(400);
    });
});
