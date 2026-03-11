import prisma from '@/lib/db';
import { Patient } from '@/generated/prisma/client';

// ─── Types ────────────────────────────────────
export interface PatientFormData {
    firstName: string;
    lastName: string;
    dob: string; // YYYY-MM-DD
    phone: string;
    email: string;
    insuranceProvider?: string;
    insurancePolicyNumber?: string;
    currentMedications?: string;
    allergies?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    reasonForVisit?: string;
}

export interface TransactionInput {
    transactionId: string;
    patientId: string;
    paymentId: string;
    receiptUrl?: string;
    receiptNumber?: string;
    amount: number;
    currency?: string;
    status?: string;
    cardBrand?: string;
    lastFour?: string;
    reason?: string;
}

export interface CheckInInput {
    patientId: string;
    appointmentConfirmed?: boolean;
    paymentStatus?: string;
    transactionId?: string;
    reasonForVisit?: string;
}

// ─── Generate Patient ID ──────────────────────
function generatePatientId(): string {
    const now = new Date();
    const timestamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
    ].join('');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `PAT-${timestamp}-${random}`;
}

// ─── Find Patient ─────────────────────────────
export async function findPatient(
    email: string,
    firstName?: string,
    lastName?: string,
    dob?: Date
): Promise<Patient | null> {
    // Primary lookup: by email
    const byEmail = await prisma.patient.findUnique({
        where: { email: email.toLowerCase() },
    });
    if (byEmail) return byEmail;

    // Secondary lookup: by name + DOB
    if (firstName && lastName && dob) {
        const byNameDob = await prisma.patient.findFirst({
            where: {
                first_name: { equals: firstName, mode: 'insensitive' },
                last_name: { equals: lastName, mode: 'insensitive' },
                dob,
            },
        });
        if (byNameDob) return byNameDob;
    }

    return null;
}

// ─── Find Patient By ID ──────────────────────
export async function findPatientById(patientId: string): Promise<Patient | null> {
    return await prisma.patient.findUnique({
        where: { patient_id: patientId },
    });
}

// ─── Create Patient ───────────────────────────
export async function createPatient(data: PatientFormData): Promise<{ patientId: string }> {
    const patientId = generatePatientId();

    await prisma.patient.create({
        data: {
            patient_id: patientId,
            first_name: data.firstName,
            last_name: data.lastName,
            dob: new Date(data.dob),
            phone: data.phone,
            email: data.email.toLowerCase(),
            insurance_provider: data.insuranceProvider || 'Self-Pay',
            insurance_policy_number: data.insurancePolicyNumber || null,
            current_medications: data.currentMedications || 'None',
            allergies: data.allergies || 'None',
            emergency_contact_name: data.emergencyContactName || null,
            emergency_contact_phone: data.emergencyContactPhone || null,
        },
    });

    return { patientId };
}

// ─── Update Patient With Audit ───────────────
const FIELDS_TO_COMPARE: { formKey: keyof PatientFormData; dbKey: keyof Patient }[] = [
    { formKey: 'phone', dbKey: 'phone' },
    { formKey: 'email', dbKey: 'email' },
    { formKey: 'insuranceProvider', dbKey: 'insurance_provider' },
    { formKey: 'insurancePolicyNumber', dbKey: 'insurance_policy_number' },
    { formKey: 'currentMedications', dbKey: 'current_medications' },
    { formKey: 'allergies', dbKey: 'allergies' },
    { formKey: 'emergencyContactName', dbKey: 'emergency_contact_name' },
    { formKey: 'emergencyContactPhone', dbKey: 'emergency_contact_phone' },
];

export async function updatePatientWithAudit(
    patientId: string,
    newData: PatientFormData,
    existingData: Patient
): Promise<{ updated: boolean; changes: { field: string; oldValue: string; newValue: string }[] }> {
    const changes: { field: string; oldValue: string; newValue: string }[] = [];

    for (const { formKey, dbKey } of FIELDS_TO_COMPARE) {
        const newVal = (newData[formKey] || '').toString().trim();
        const oldVal = (existingData[dbKey] || '').toString().trim();

        if (newVal && newVal !== oldVal) {
            changes.push({ field: dbKey as string, oldValue: oldVal, newValue: newVal });
        }
    }

    if (changes.length === 0) {
        return { updated: false, changes: [] };
    }

    // Use a Prisma transaction for atomicity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
        // Insert audit log entries
        await tx.patientAuditLog.createMany({
            data: changes.map((c) => ({
                patient_id: patientId,
                field_changed: c.field,
                old_value: c.oldValue,
                new_value: c.newValue,
            })),
        });

        // Build update object
        const updateData: Record<string, unknown> = { version: { increment: 1 } };
        for (const { formKey, dbKey } of FIELDS_TO_COMPARE) {
            const newVal = (newData[formKey] || '').toString().trim();
            if (newVal) {
                updateData[dbKey as string] = newVal;
            }
        }

        await tx.patient.update({
            where: { patient_id: patientId },
            data: updateData,
        });
    });

    return { updated: true, changes };
}

// ─── Log Transaction ──────────────────────────
export async function logTransaction(data: TransactionInput): Promise<void> {
    await prisma.transaction.create({
        data: {
            transaction_id: data.transactionId,
            patient_id: data.patientId,
            payment_id: data.paymentId,
            square_receipt_url: data.receiptUrl || null,
            square_receipt_number: data.receiptNumber || null,
            amount: data.amount,
            currency: data.currency || 'USD',
            status: data.status || 'COMPLETED',
            card_brand: data.cardBrand || null,
            card_last_four: data.lastFour || null,
            reason_for_visit: data.reason || null,
        },
    });
}

// ─── Log Check-In ─────────────────────────────
export async function logCheckIn(data: CheckInInput): Promise<void> {
    await prisma.checkInLog.create({
        data: {
            patient_id: data.patientId,
            appointment_confirmed: data.appointmentConfirmed || false,
            payment_status: data.paymentStatus || null,
            transaction_id: data.transactionId || null,
            reason_for_visit: data.reasonForVisit || null,
        },
    });
}

// ─── Find Latest Unpaid Check-In ───────────────
export async function findLatestUnpaidCheckIn(patientId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return await prisma.checkInLog.findFirst({
        where: {
            patient_id: patientId,
            payment_status: 'UNPAID',
            check_in_time: { gte: today },
        },
        orderBy: { check_in_time: 'desc' },
    });
}

// ─── Update Check-In ──────────────────────────
export async function updateCheckIn(logId: number, data: Partial<CheckInInput>): Promise<void> {
    await prisma.checkInLog.update({
        where: { id: logId },
        data: {
            appointment_confirmed: data.appointmentConfirmed,
            payment_status: data.paymentStatus,
            transaction_id: data.transactionId,
            reason_for_visit: data.reasonForVisit,
        },
    });
}
