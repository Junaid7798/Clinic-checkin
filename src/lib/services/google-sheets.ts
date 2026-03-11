import { google } from 'googleapis';
import { getGoogleAuth } from './google-auth';

// ─── Types ────────────────────────────────────
export interface PatientFormData {
    patient_id: string;
    first_name: string;
    last_name: string;
    dob: string;
    phone: string;
    email: string;
    insurance_provider: string;
    insurance_policy_number: string;
    current_medications: string;
    allergies: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
}

export interface TransactionData {
    transaction_id: string;
    patient_id: string;
    payment_id: string;
    receipt_url: string;
    amount: string;
    currency: string;
    status: string;
    card_last_four: string;
    reason: string;
    date: string;
}

export interface CheckInData {
    patient_id: string;
    patient_name: string;
    check_in_time: string;
    appointment_found: boolean;
    slot_booked: string;
    payment_status: string;
    transaction_id: string;
    reason: string;
}

// ─── Helper: Get Sheets Client ────────────────
function getSheets() {
    const auth = getGoogleAuth();
    return google.sheets({ version: 'v4', auth });
}

const SHEET_ID = () => process.env.GOOGLE_SHEET_ID!;

// ─── Patient Headers ─────────────────────
const PATIENT_HEADERS = [
    'patient_id', 'first_name', 'last_name', 'dob', 'phone', 'email',
    'insurance_provider', 'insurance_policy_number', 'current_medications',
    'allergies', 'emergency_contact_name', 'emergency_contact_phone',
    'created_at', 'updated_at',
];

// ─── Lookup Patient ───────────────────────────
export async function lookupPatient(email: string): Promise<{
    found: boolean;
    rowIndex: number | null;
    data: Record<string, string> | null;
}> {
    try {
        const sheets = getSheets();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID(),
            range: 'Patients!A:N',
        });

        const rows = response.data.values || [];
        if (rows.length <= 1) return { found: false, rowIndex: null, data: null };

        const headers = rows[0];
        const emailIndex = headers.indexOf('email');
        if (emailIndex === -1) return { found: false, rowIndex: null, data: null };

        for (let i = 1; i < rows.length; i++) {
            if (rows[i][emailIndex]?.toLowerCase() === email.toLowerCase()) {
                const data: Record<string, string> = {};
                headers.forEach((header: string, idx: number) => {
                    data[header] = rows[i][idx] || '';
                });
                return { found: true, rowIndex: i + 1, data }; // +1 because Sheets is 1-indexed
            }
        }

        return { found: false, rowIndex: null, data: null };
    } catch (error) {
        console.error('[Google Sheets] lookupPatient error:', error);
        return { found: false, rowIndex: null, data: null };
    }
}

// ─── Create Patient ───────────────────────────
export async function createPatient(data: PatientFormData): Promise<{ success: boolean }> {
    try {
        const sheets = getSheets();
        const now = new Date().toISOString();

        const row = PATIENT_HEADERS.map((header) => {
            if (header === 'created_at' || header === 'updated_at') return now;
            return (data as unknown as Record<string, string>)[header] || '';
        });

        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID(),
            range: 'Patients!A:N',
            valueInputOption: 'RAW',
            requestBody: { values: [row] },
        });

        return { success: true };
    } catch (error) {
        console.error('[Google Sheets] createPatient error:', error);
        return { success: false };
    }
}

// ─── Update Patient ───────────────────────────
export async function updatePatient(
    rowIndex: number,
    data: Partial<PatientFormData>
): Promise<{ success: boolean }> {
    try {
        const sheets = getSheets();

        // First, get current row data
        const range = `Patients!A${rowIndex}:N${rowIndex}`;
        const current = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID(),
            range,
        });

        const currentRow = current.data.values?.[0] || [];
        const updatedRow = PATIENT_HEADERS.map((header, idx) => {
            if (header === 'updated_at') return new Date().toISOString();
            if (header in data) return (data as unknown as Record<string, string>)[header];
            return currentRow[idx] || '';
        });

        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID(),
            range,
            valueInputOption: 'RAW',
            requestBody: { values: [updatedRow] },
        });

        return { success: true };
    } catch (error) {
        console.error('[Google Sheets] updatePatient error:', error);
        return { success: false };
    }
}

// ─── Log Transaction ──────────────────────────
export async function logTransaction(data: TransactionData): Promise<{ success: boolean }> {
    try {
        const sheets = getSheets();
        const row = [
            data.transaction_id,
            data.patient_id,
            data.payment_id,
            data.receipt_url,
            data.amount,
            data.currency,
            data.status,
            data.card_last_four,
            data.reason,
            data.date,
        ];

        // Determine the dynamic monthly tab name, e.g., "Transactions_Mar_2026"
        const now = new Date();
        const month = now.toLocaleString('en-US', { month: 'short' });
        const year = now.getFullYear();
        const monthlyTabName = `Transactions_${month}_${year}`;
        const range = `${monthlyTabName}!A:J`;

        try {
            // Attempt to append directly
            await sheets.spreadsheets.values.append({
                spreadsheetId: SHEET_ID(),
                range: range,
                valueInputOption: 'RAW',
                requestBody: { values: [row] },
            });
        } catch (appendErr: any) {
            // If the sheet doesn't exist, the API throws a 400 error: "Unable to parse range"
            if (appendErr.message && appendErr.message.includes('Unable to parse range')) {
                console.log(`[Google Sheets] Tab ${monthlyTabName} not found. Creating it...`);
                
                // 1. Create the new sheet tab
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: SHEET_ID(),
                    requestBody: {
                        requests: [{
                            addSheet: {
                                properties: {
                                    title: monthlyTabName,
                                    gridProperties: { frozenRowCount: 1 }
                                }
                            }
                        }]
                    }
                });

                // 2. Add header row
                const headers = ["Transaction ID", "Patient ID", "Payment ID", "Receipt URL", "Amount", "Currency", "Status", "Card Last 4", "Reason", "Date"];
                await sheets.spreadsheets.values.append({
                    spreadsheetId: SHEET_ID(),
                    range: range,
                    valueInputOption: 'RAW',
                    requestBody: { values: [headers] },
                });

                // 3. Retry appending the transaction data
                await sheets.spreadsheets.values.append({
                    spreadsheetId: SHEET_ID(),
                    range: range,
                    valueInputOption: 'RAW',
                    requestBody: { values: [row] },
                });
            } else {
                // If it's a different error, throw it so the catch block below handles it
                throw appendErr;
            }
        }

        return { success: true };
    } catch (error) {
        console.error('[Google Sheets] logTransaction error:', error);
        return { success: false };
    }
}

// ─── Log Check-In ─────────────────────────────
export async function logCheckIn(data: CheckInData): Promise<{ success: boolean }> {
    try {
        const sheets = getSheets();
        const row = [
            data.patient_id,
            data.patient_name,
            data.check_in_time,
            data.appointment_found ? 'Yes' : 'No',
            data.slot_booked || '',
            data.payment_status,
            data.transaction_id || '',
            data.reason,
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID(),
            range: 'Check-In Log!A:H',
            valueInputOption: 'RAW',
            requestBody: { values: [row] },
        });

        return { success: true };
    } catch (error) {
        console.error('[Google Sheets] logCheckIn error:', error);
        return { success: false };
    }
}
