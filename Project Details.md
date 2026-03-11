# Project Details - Eyecare Check-In

A premium, state-of-the-art patient check-in kiosk application built for modern eye care clinics. This application streamlines the patient arrival process, handles real-time appointment verification, and processes payments securely.

## 🚀 Overview

The Eyecare Check-In system is a Next.js-powered web application designed to be used on a tablet/kiosk at the front desk. It guides patients through a multi-language (English/Spanish) flow to verify their information, book slots if they don't have an appointment, and pay their copay.

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (Glassmorphism design system)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Database**: PostgreSQL with Prisma ORM (Hosted on Neon)
- **Integrations**:
    - **Square**: Payments (Copay) & Booking API
    - **Google Calendar**: Appointment scheduling and availability
    - **Google Sheets**: Real-time logging of transactions, check-ins, and patient records
    - **Vonage**: SMS OTP verification and Voice Reminders
    - **Nodemailer**: Automated internal notifications (e.g., new lead alerts)

## 📁 Project Structure

```text
src/
├── app/                  # Route handlers and UI pages
│   ├── admin/            # Secure Admin Dashboard
│   ├── api/              # Internal API endpoints (Square, Google, etc.)
│   ├── appointment/      # Slot selection logic
│   ├── payment/          # Square payment integration
│   ├── verify/           # SMS OTP verification flow
│   └── page.tsx          # Multi-step check-in form
├── components/           # Reusable UI components
├── contexts/             # React Context for state management (CheckInContext)
├── lib/                  # Shared utilities and services
│   ├── services/         # Third-party integrations (Square, Google, Vonage)
│   └── translations.ts   # Multi-language support
└── prisma/               # Database schema and migrations
```

## 🗄 Database Schema

The system uses Prisma to manage a PostgreSQL database with the following core models:
- `Patient`: Stores persistent patient records.
- `Transaction`: Records all successful Square payments.
- `CheckInLog`: Logs every check-in event for administrative review.
- `Admin`: Simple authentication storage for dashboard access.

## 🔌 Core Integrations

### Square
Handles all monetary transactions and syncs with the clinic's Square Appointments booking system. Includes webhook support for real-time status updates.

### Google Ecosystem
- **Calendar**: Used as the primary source of truth for clinic availability.
- **Sheets**: Acting as a "living database" where staff can view check-in activity and financial logs without needing database access.

### Vonage
Provides the security layer via SMS OTP to ensure patients are using valid phone numbers. Also used for admin-triggered voice reminders.

## 🚢 Deployment

The application is optimized for deployment on **Vercel**, utilizing Next.js Edge functions and optimized build pipelines.
