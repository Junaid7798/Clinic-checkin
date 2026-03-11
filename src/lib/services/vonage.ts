import { Vonage } from '@vonage/server-sdk';

// ─── Types ────────────────────────────────────
export interface SendOTPResult {
    requestId: string;
}

export interface VerifyOTPResult {
    verified: boolean;
}

export interface SendSMSResult {
    success: boolean;
}

// ─── Vonage Client ────────────────────────────
const OTP_BYPASS_ENABLED =
    process.env.NODE_ENV !== 'production' && process.env.ALLOW_OTP_BYPASS === 'true';

function getVonageClient() {
    return new Vonage({
        apiKey: process.env.VONAGE_API_KEY!,
        apiSecret: process.env.VONAGE_API_SECRET!,
    });
}

// ─── Send OTP ─────────────────────────────────
export async function sendOTP(phoneNumber: string): Promise<SendOTPResult> {
    try {
        // Dev/test bypass - only when explicitly enabled
        if (OTP_BYPASS_ENABLED) {
            return { requestId: 'test-request-id' };
        }

        const vonage = getVonageClient();

        const response = await vonage.verify.start({
            number: phoneNumber,
            brand: process.env.CLINIC_NAME || 'Clinic',
            codeLength: 6,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((response as any).status && (response as any).status !== '0') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            throw new Error(`Vonage API Error: ${(response as any).error_text || 'Unknown Error'}`);
        }

        if (!response.request_id) {
            throw new Error('No request ID returned from Vonage');
        }

        return { requestId: response.request_id };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error sending OTP';
        console.error('[Vonage] sendOTP error:', message);
        throw new Error(message);
    }
}

// ─── Verify OTP ───────────────────────────────
export async function verifyOTP(requestId: string, code: string): Promise<VerifyOTPResult> {
    try {
        // Dev/test bypass - only when explicitly enabled
        if (OTP_BYPASS_ENABLED && code === '000000') {
            return { verified: true };
        }

        const vonage = getVonageClient();

        const response = await vonage.verify.check(requestId, code);

        return { verified: response.status === '0' };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error verifying OTP';
        console.error('[Vonage] verifyOTP error:', message);
        // Non-match codes return errors from Vonage — treat as not verified
        return { verified: false };
    }
}

// ─── Send SMS ─────────────────────────────────
export async function sendSMS(to: string, message: string): Promise<SendSMSResult> {
    try {
        // Dev mode — just log
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Vonage SMS] To: ${to}, Message: ${message}`);
            return { success: true };
        }

        const vonage = getVonageClient();

        const response = await vonage.sms.send({
            from: process.env.VONAGE_FROM_NUMBER!,
            to,
            text: message,
        });

        const sent = response.messages[0];
        if (sent.status !== '0') {
            console.error('[Vonage] SMS send failed:', sent.errorText);
            return { success: false };
        }

        return { success: true };
    } catch (error) {
        const message_ = error instanceof Error ? error.message : 'Unknown error sending SMS';
        console.error('[Vonage] sendSMS error:', message_);
        return { success: false };
    }
}

// ─── Send Voice Reminder ───────────────────────
export async function sendVoiceReminder(to: string, patientName: string, appointmentTime: string): Promise<{ success: boolean }> {
    try {
        const vonage = getVonageClient();
        
        // Voice text-to-speech message
        const message = `Hello ${patientName}. This is a reminder of your appointment at ${appointmentTime}. We look forward to seeing you.`;

        if (process.env.NODE_ENV === 'development') {
            console.log(`[Vonage Voice Reminder] To: ${to}, Message: ${message}`);
            return { success: true };
        }

        const response = await vonage.voice.createOutboundCall({
            to: [{ type: 'phone', number: to }],
            from: { type: 'phone', number: process.env.VONAGE_FROM_NUMBER! },
            ncco: [
                {
                    action: 'talk',
                    text: message,
                    voiceName: 'Jennifer'
                }
            ],
        });

        return { success: !!response.uuid };
    } catch (error) {
        console.error('[Vonage] sendVoiceReminder error:', error);
        return { success: false };
    }
}
