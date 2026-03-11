import nodemailer from 'nodemailer';
// @ts-expect-error - Missing types for PDFKit
import PDFDocument from 'pdfkit';
import * as ics from 'ics';

// ─── Types ────────────────────────────────────
export interface ReceiptEmailParams {
  to: string;
  patientName: string;
  amount: number;
  currency: string;
  transactionId: string;
  paymentId: string;
  receiptUrl: string;
  cardBrand: string;
  lastFour: string;
  reason: string;
  date: string;
  appointmentTime?: string;
}

export interface FrontDeskAlertParams {
  patientName: string;
  email: string;
  phone: string;
  reason: string;
  error: string;
}

// ─── Clinic Config ────────────────────────────
function getClinicConfig() {
  return {
    name: process.env.CLINIC_NAME || 'Clinic',
    email: process.env.CLINIC_EMAIL || 'clinic@example.com',
    phone: process.env.CLINIC_PHONE || '',
    address: process.env.CLINIC_ADDRESS || '',
  };
}

function getTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    // Production-safe no-op: log and return a jsonTransport so calls don't crash the app
    console.warn(
        '[Email] No SMTP provider configured. Emails will be logged only. Set SMTP_HOST/SMTP_USER/SMTP_PASS to enable real delivery.'
    );
    return nodemailer.createTransport({
        jsonTransport: true,
    });
}

// ─── Receipt Email HTML Template ──────────────
function buildReceiptHTML(params: ReceiptEmailParams): string {
  const clinic = getClinicConfig();
  const formattedAmount = `$${(params.amount / 100).toFixed(2)}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
    <!-- Header -->
    <tr>
      <td style="background:#1A5276;padding:24px 32px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;">${clinic.name}</h1>
        <p style="color:#B0D0E8;margin:8px 0 0;font-size:14px;">Payment Receipt</p>
      </td>
    </tr>
    <!-- Body -->
    <tr>
      <td style="padding:32px;">
        <p style="font-size:18px;color:#333;">Thank you, <strong>${params.patientName}</strong>!</p>
        <p style="font-size:14px;color:#666;line-height:1.6;">
          Your payment has been successfully processed. Here is your receipt:
        </p>
        <!-- Receipt Table -->
        <table width="100%" cellpadding="10" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:8px;margin:20px 0;">
          <tr style="background:#f9f9f9;"><td style="font-weight:bold;color:#555;">Transaction ID</td><td style="color:#333;">${params.transactionId}</td></tr>
          <tr><td style="font-weight:bold;color:#555;">Payment ID</td><td style="color:#333;">${params.paymentId}</td></tr>
          <tr style="background:#f9f9f9;"><td style="font-weight:bold;color:#555;">Amount</td><td style="color:#27AE60;font-weight:bold;font-size:18px;">${formattedAmount} ${params.currency}</td></tr>
          <tr><td style="font-weight:bold;color:#555;">Card</td><td style="color:#333;">${params.cardBrand} ending in ${params.lastFour}</td></tr>
          <tr style="background:#f9f9f9;"><td style="font-weight:bold;color:#555;">Reason</td><td style="color:#333;">${params.reason}</td></tr>
          <tr><td style="font-weight:bold;color:#555;">Date</td><td style="color:#333;">${params.date}</td></tr>
          <tr style="background:#f9f9f9;"><td style="font-weight:bold;color:#555;">Status</td><td style="color:#27AE60;font-weight:bold;">✅ COMPLETED</td></tr>
        </table>
        ${params.receiptUrl ? `
        <div style="text-align:center;margin:24px 0;">
          <a href="${params.receiptUrl}" style="display:inline-block;background:#1A5276;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:16px;">View Square Receipt</a>
        </div>` : ''}
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background:#f0f0f0;padding:20px 32px;text-align:center;">
        <p style="font-size:12px;color:#888;margin:0;">${clinic.name}</p>
        <p style="font-size:12px;color:#888;margin:4px 0;">${clinic.address}</p>
        <p style="font-size:12px;color:#888;margin:4px 0;">${clinic.phone} | ${clinic.email}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Document Generators ──────────────────────
async function generatePdfBuffer(params: ReceiptEmailParams): Promise<Buffer | null> {
    return new Promise((resolve) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const chunks: Buffer[] = [];
            
            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            
            doc.fontSize(20).text(process.env.CLINIC_NAME || 'Clinic', { align: 'center' });
            doc.moveDown();
            doc.fontSize(14).text('Payment Receipt', { align: 'center' });
            doc.moveDown(2);
            
            doc.fontSize(12).text(`Patient Name: ${params.patientName}`);
            doc.text(`Date: ${params.date}`);
            doc.text(`Transaction ID: ${params.transactionId}`);
            doc.text(`Payment ID: ${params.paymentId}`);
            doc.moveDown();
            
            doc.fontSize(16).fillColor('green').text(`Amount Paid: ${(params.amount / 100).toFixed(2)} ${params.currency}`);
            doc.fontSize(12).fillColor('black').text(`Card: ${params.cardBrand} ending in ${params.lastFour}`);
            
            doc.end();
        } catch (error) {
            console.error('[PDF Generator] Error:', error);
            resolve(null);
        }
    });
}

function generateIcsBuffer(params: ReceiptEmailParams): Buffer | null {
    try {
        if (!params.appointmentTime) return null;
        
        const start = new Date(params.appointmentTime);
        if (isNaN(start.getTime())) return null;
        
        const event: ics.EventAttributes = {
            start: [start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()],
            duration: { minutes: 30 },
            title: `Appointment - ${process.env.CLINIC_NAME || 'Clinic'}`,
            description: `Reason: ${params.reason}\nTransaction: ${params.transactionId}`,
            location: process.env.CLINIC_ADDRESS || 'Clinic',
            url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            status: 'CONFIRMED',
            busyStatus: 'BUSY',
            organizer: { name: process.env.CLINIC_NAME || 'Clinic', email: process.env.CLINIC_EMAIL || 'clinic@example.com' },
            attendees: [
                { name: params.patientName, email: params.to, rsvp: true, partstat: 'ACCEPTED', role: 'REQ-PARTICIPANT' }
            ]
        };
        
        const { error, value } = ics.createEvent(event);
        if (error || !value) {
            console.error('[ICS Generator] Error:', error);
            return null;
        }
        
        return Buffer.from(value);
    } catch (error) {
        console.error('[ICS Generator] Fatal Error:', error);
        return null;
    }
}

// ─── Send Receipt Email ───────────────────────
export async function sendReceiptEmail(params: ReceiptEmailParams): Promise<{ success: boolean }> {
  try {
    const clinic = getClinicConfig();
    const transporter = getTransporter();

    const attachments = [];
    
    // Safely generate PDF
    const pdfBuffer = await generatePdfBuffer(params);
    if (pdfBuffer) {
        attachments.push({
            filename: 'Receipt.pdf',
            content: pdfBuffer,
            contentType: 'application/pdf'
        });
    }

    // Safely generate ICS
    const icsBuffer = generateIcsBuffer(params);
    if (icsBuffer) {
        attachments.push({
            filename: 'appointment.ics',
            content: icsBuffer,
            contentType: 'text/calendar'
        });
    }

    const result = await transporter.sendMail({
      from: `"${clinic.name}" <${clinic.email}>`,
      to: params.to,
      subject: `✅ Eye Care Visit Receipt - ${params.patientName} - ${params.date}`,
      html: buildReceiptHTML(params),
      attachments,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[Email] Receipt email (dev mode):', result.messageId);
    }

    return { success: true };
  } catch (error) {
    console.error('[Email] sendReceiptEmail error:', error);
    return { success: false };
  }
}

export async function sendReviewRequestEmail(patientName: string, email: string): Promise<boolean> {
  try {
    const clinic = getClinicConfig();
    const transporter = getTransporter();

    const reviewLink = process.env.GOOGLE_REVIEW_LINK || 'https://google.com';

    await transporter.sendMail({
      from: `"${clinic.name}" <${clinic.email}>`,
      to: email,
      subject: `How was your visit at ${clinic.name}?`,
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:auto;">
          <h2>Thank you for visiting ${clinic.name}!</h2>
          <p>Hi ${patientName},</p>
          <p>We hope you had a great experience with us. As a local clinic, we rely on patient feedback to improve our services and help others find us.</p>
          <p>If you have 60 seconds, we would genuinely appreciate it if you left us a quick review on Google:</p>
          <a href="${reviewLink}" style="display:inline-block;padding:12px 24px;background-color:#1A5276;color:white;text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">Leave a Review</a>
          <p>Thank you again for choosing us for your eye care needs.</p>
          <p>Best regards,<br/>The ${clinic.name} Team</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error('[Email] sendReviewRequestEmail error:', error);
    return false;
  }
}

// ─── Send Front Desk Alert ────────────────────
export async function sendFrontDeskAlert(params: FrontDeskAlertParams): Promise<void> {
  try {
    const clinic = getClinicConfig();
    const transporter = getTransporter();

    await transporter.sendMail({
      from: `"${clinic.name} System" <${clinic.email}>`,
      to: clinic.email,
      subject: `⚠️ PAYMENT FAILED - ${params.patientName} - Check-In`,
      html: `
        <h2 style="color:#E74C3C;">Payment Failed — Front Desk Action Required</h2>
        <table cellpadding="8" cellspacing="0" style="border:1px solid #ddd;">
          <tr><td><strong>Patient</strong></td><td>${params.patientName}</td></tr>
          <tr><td><strong>Email</strong></td><td>${params.email}</td></tr>
          <tr><td><strong>Phone</strong></td><td>${params.phone}</td></tr>
          <tr><td><strong>Reason</strong></td><td>${params.reason}</td></tr>
          <tr><td><strong>Error</strong></td><td style="color:#E74C3C;">${params.error}</td></tr>
          <tr><td><strong>Time</strong></td><td>${new Date().toLocaleString()}</td></tr>
        </table>
        <p>Please assist this patient at the front desk.</p>
      `,
    });
  } catch (error) {
    console.error('[Email] sendFrontDeskAlert error:', error);
  }
}
