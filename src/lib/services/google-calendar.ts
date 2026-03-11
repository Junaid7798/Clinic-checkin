import { google } from 'googleapis';
import { getGoogleAuth } from './google-auth';

// ─── Types ────────────────────────────────────
export interface AppointmentInfo {
    source: string;
    title: string;
    startTime: string;
    endTime: string;
    location: string;
    eventId: string;
}

export interface SlotInfo {
    time: string;      // HH:mm
    display: string;   // h:mm AM/PM
    available: boolean;
}

export interface CreateAppointmentParams {
    patientName: string;
    email: string;
    phone: string;
    startTime: string;
    reason: string;
}

// ─── Helper: Get Calendar Client ──────────────
function getCalendar() {
    const auth = getGoogleAuth();
    return google.calendar({ version: 'v3', auth });
}

// ─── Get Today's Appointments ─────────────────
export async function getTodayAppointments(
    patientEmail: string,
    date?: string
): Promise<{ found: boolean; appointment: AppointmentInfo | null }> {
    try {
        const calendar = getCalendar();
        const targetDate = date ? new Date(date) : new Date();

        const timeMin = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const timeMax = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

        const response = await calendar.events.list({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = response.data.items || [];

        // Find event matching patient email (in attendees or description)
        const matchingEvent = events.find((event) => {
            const attendees = event.attendees || [];
            const hasAttendee = attendees.some(
                (a) => a.email?.toLowerCase() === patientEmail.toLowerCase()
            );
            const inDescription = event.description?.toLowerCase().includes(patientEmail.toLowerCase());
            const inSummary = event.summary?.toLowerCase().includes(patientEmail.toLowerCase());
            return hasAttendee || inDescription || inSummary;
        });

        if (matchingEvent) {
            return {
                found: true,
                appointment: {
                    source: 'google-calendar',
                    title: matchingEvent.summary || 'Appointment',
                    startTime: matchingEvent.start?.dateTime || matchingEvent.start?.date || '',
                    endTime: matchingEvent.end?.dateTime || matchingEvent.end?.date || '',
                    location: matchingEvent.location || 'Clinic',
                    eventId: matchingEvent.id || '',
                },
            };
        }

        return { found: false, appointment: null };
    } catch (error) {
        console.error('[Google Calendar] getTodayAppointments error:', error);
        return { found: false, appointment: null };
    }
}

// ─── Get All Today's Appointments ─────────────
export async function getAllTodayAppointments(date?: string): Promise<AppointmentInfo[]> {
    try {
        const calendar = getCalendar();
        const targetDate = date ? new Date(date) : new Date();

        const timeMin = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const timeMax = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

        const response = await calendar.events.list({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = response.data.items || [];
        return events.map(matchingEvent => ({
            source: 'google-calendar',
            title: matchingEvent.summary || 'Appointment',
            startTime: matchingEvent.start?.dateTime || matchingEvent.start?.date || '',
            endTime: matchingEvent.end?.dateTime || matchingEvent.end?.date || '',
            location: matchingEvent.location || 'Clinic',
            eventId: matchingEvent.id || '',
        }));
    } catch (error) {
        console.error('[Google Calendar] getAllTodayAppointments error:', error);
        return [];
    }
}

// ─── Delete Appointment ───────────────────────
export async function deleteAppointment(eventId: string): Promise<void> {
    try {
        const calendar = getCalendar();
        await calendar.events.delete({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            eventId,
        });
    } catch (error) {
        console.error('[Google Calendar] deleteAppointment error:', error);
        throw error;
    }
}

// ─── Get Available Slots ──────────────────────
export async function getAvailableSlots(date?: string): Promise<{
    date: string;
    slots: SlotInfo[];
    closed: boolean;
}> {
    const calendar = getCalendar();
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    const openHour = parseInt(process.env.CLINIC_OPEN_HOUR || '9', 10);
    const closeHour = parseInt(process.env.CLINIC_CLOSE_HOUR || '17', 10);
    const duration = parseInt(process.env.APPOINTMENT_DURATION_MINUTES || '30', 10);

    const now = new Date();
    const isToday = dateStr === now.toISOString().split('T')[0];
    
    // Check if clinic is closed for today
    const currentHour = now.getHours();
    const clinicClosed = isToday && currentHour >= closeHour;

    // Generate all possible slots
    const allSlots: SlotInfo[] = [];
    for (let hour = openHour; hour < closeHour; hour++) {
        for (let min = 0; min < 60; min += duration) {
            if (hour === closeHour - 1 && min + duration > 60) break;
            const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
            const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayStr = `${displayHour}:${min.toString().padStart(2, '0')} ${ampm}`;
            allSlots.push({ time: timeStr, display: displayStr, available: true });
        }
    }

    try {
        // Get busy times from Google Calendar
        const timeMin = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), openHour);
        const timeMax = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), closeHour);

        const freeBusyResponse = await calendar.freebusy.query({
            requestBody: {
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
                items: [{ id: process.env.GOOGLE_CALENDAR_ID }],
            },
        });

        const calendarId = process.env.GOOGLE_CALENDAR_ID || '';
        const busyPeriods = freeBusyResponse.data.calendars?.[calendarId]?.busy || [];

        // Mark overlapping slots as unavailable
        for (const slot of allSlots) {
            const [slotHour, slotMin] = slot.time.split(':').map(Number);
            const slotStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), slotHour, slotMin);
            const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

            for (const busy of busyPeriods) {
                const busyStart = new Date(busy.start!);
                const busyEnd = new Date(busy.end!);
                // Overlap check
                if (slotStart < busyEnd && slotEnd > busyStart) {
                    slot.available = false;
                    break;
                }
            }
        }
    } catch (error) {
        console.error('[Google Calendar] getAvailableSlots freebusy error:', error);
    }

    // Remove past slots (only if date is today)
    if (isToday) {
        const bufferMinutes = 30;
        const cutoff = new Date(now.getTime() + bufferMinutes * 60 * 1000);
        for (const slot of allSlots) {
            const [slotHour, slotMin] = slot.time.split(':').map(Number);
            const slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slotHour, slotMin);
            if (slotTime <= cutoff) {
                slot.available = false;
            }
        }
    }

    return { date: dateStr, slots: allSlots, closed: clinicClosed };
}

// ─── Create Appointment ───────────────────────
export async function createAppointment(params: CreateAppointmentParams): Promise<{
    eventId: string;
    startTime: string;
    endTime: string;
}> {
    try {
        const calendar = getCalendar();
        const duration = parseInt(process.env.APPOINTMENT_DURATION_MINUTES || '30', 10);

        const startDateTime = new Date(params.startTime);
        const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

        const response = await calendar.events.insert({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            requestBody: {
                summary: `Eye Care Appointment - ${params.patientName}`,
                description: [
                    `Patient: ${params.patientName}`,
                    `Phone: ${params.phone}`,
                    `Reason: ${params.reason}`,
                    `Email: ${params.email}`,
                    '',
                    'Booked via Self Check-In Kiosk',
                ].join('\n'),
                start: { dateTime: startDateTime.toISOString() },
                end: { dateTime: endDateTime.toISOString() },
            },
        });

        return {
            eventId: response.data.id || '',
            startTime: response.data.start?.dateTime || startDateTime.toISOString(),
            endTime: response.data.end?.dateTime || endDateTime.toISOString(),
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown calendar error';
        console.error('[Google Calendar] createAppointment error:', message);
        throw new Error(`Failed to book appointment: ${message}`);
    }
}
