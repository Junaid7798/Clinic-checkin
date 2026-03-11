import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { z } from 'zod';
import * as patientDb from '@/lib/services/patient-db';
import * as googleSheets from '@/lib/services/google-sheets';

const checkinSchema = z.object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD'),
    phone: z.string().min(1, 'Phone is required'),
    email: z.string().email('Valid email is required'),
    insuranceProvider: z.string().optional(),
    insurancePolicyNumber: z.string().optional(),
    currentMedications: z.string().optional(),
    allergies: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    reasonForVisit: z.string().min(1, 'Reason for visit is required'),
});

export async function POST(request: NextRequest) {
    let patientId: string | undefined;
    let reasonForVisit: string | undefined;

    try {
        const body = await request.json();
        const parsed = checkinSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        // Normalize data
        const data = {
            ...parsed.data,
            firstName: parsed.data.firstName.trim(),
            lastName: parsed.data.lastName.trim(),
            email: parsed.data.email.trim().toLowerCase(),
            phone: parsed.data.phone.replace(/\D/g, ''),
        };
        reasonForVisit = data.reasonForVisit;

        // Step 1: Look up patient in PostgreSQL
        const existingPatient = await patientDb.findPatient(
            data.email,
            data.firstName,
            data.lastName,
            new Date(data.dob)
        );

        let updated = false;
        let changes: any[] = [];

        if (existingPatient) {
            patientId = existingPatient.patient_id;
            // Step 2: Compare and update with audit trail
            const updateResult = await patientDb.updatePatientWithAudit(
                existingPatient.patient_id,
                data,
                existingPatient
            );
            updated = updateResult.updated;
            changes = updateResult.changes;

            // Step 3: Sync to Google Sheets (non-blocking)
            if (updated) {
                try {
                    const sheetsResult = await googleSheets.lookupPatient(data.email);
                    if (sheetsResult.found && sheetsResult.rowIndex) {
                        await googleSheets.updatePatient(sheetsResult.rowIndex, {
                            ...data,
                            patient_id: existingPatient.patient_id,
                            first_name: data.firstName,
                            last_name: data.lastName,
                            insurance_provider: data.insuranceProvider || 'Self-Pay',
                            insurance_policy_number: data.insurancePolicyNumber || '',
                            current_medications: data.currentMedications || 'None',
                            allergies: data.allergies || 'None',
                            emergency_contact_name: data.emergencyContactName || '',
                            emergency_contact_phone: data.emergencyContactPhone || '',
                        });
                    }
                } catch (sheetsError) {
                    console.error('[API /checkin] Google Sheets sync failed (non-critical):', sheetsError);
                }
            }
        } else {
            // Step 4: Create new patient
            const result = await patientDb.createPatient(data);
            patientId = result.patientId;

            // Step 5: Sync to Google Sheets (non-blocking)
            try {
                await googleSheets.createPatient({
                    patient_id: patientId,
                    first_name: data.firstName,
                    last_name: data.lastName,
                    dob: data.dob,
                    phone: data.phone,
                    email: data.email,
                    insurance_provider: data.insuranceProvider || 'Self-Pay',
                    insurance_policy_number: data.insurancePolicyNumber || '',
                    current_medications: data.currentMedications || 'None',
                    allergies: data.allergies || 'None',
                    emergency_contact_name: data.emergencyContactName || '',
                    emergency_contact_phone: data.emergencyContactPhone || '',
                });
            } catch (sheetsError) {
                console.error('[API /checkin] Google Sheets create failed (non-critical):', sheetsError);
            }
        }

        // Prepare response data
        const resData = {
            patientId,
            isNew: !existingPatient,
            changesDetected: updated,
            changes,
        };

        // Step 6: Log the initial check-in (CRITICAL: Must await so log exists for Admin)
        if (patientId) {
            await patientDb.logCheckIn({
                patientId,
                paymentStatus: 'UNPAID',
                reasonForVisit: reasonForVisit,
            });
        }

        return NextResponse.json(resData);

    } catch (error) {
        console.error('[API /checkin] Detailed Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API /checkin] Error:', message);
        return NextResponse.json(
            { error: 'Check-in failed. Please see the front desk.', code: 'CHECKIN_ERROR' },
            { status: 500 }
        );
    }
}
