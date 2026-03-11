# Features List

## 👤 Patient-Facing Features

### 📝 Multi-Step Registration
- Integrated validation for each step (Personal Info, Insurance, Visit Details).
- **Auto-formatting**: Real-time phone number formatting `(XXX) XXX-XXXX`.
- **Draft Persistence**: Progress is automatically saved to LocalStorage, allowing patients to resume check-in if the page refreshes.

### 🌐 Multi-Language Support
- Full support for **English** and **Spanish**.
- Dynamic language toggling that persists across the entire flow.

### 🛡 Secure Verification
- **SMS OTP**: Secure 6-digit verification via Vonage.
- **Fail-safe Logic**: Graceful error handling and "Restart" options if codes fail to send.

### 📅 Smart Appointment Handling
- **Automated Lookup**: Automatically finds existing appointments in Google Calendar or Square.
- **Dynamic Slot Selection**: If no appointment exists, patients can pick from real-time available slots.
- **Closure Detection**: Smart detection of clinic hours (9 AM - 5 PM) with "Clinic Closed" messaging.

### 💳 Seamless Payments
- Integrated Square Payment Form.
- Supports digital wallets (Apple Pay/Google Pay) and physical card entry.
- **Flexible Flow**: Options to pay later at the front desk if enabled.

---

## 👨‍💼 Admin Features

### 📊 Real-Time Dashboard
- **KPI Cards**: Daily/Monthly revenue tracking and patient counts.
- **Live Activity Feed**: Real-time log of every patient currently check-in or waiting.

### 🛠 Actionable Management
- **Mark Seen**: One-click status updates for front desk staff.
- **Cancellations**: Directly cancel Google or Square appointments from the dashboard.
- **Voice Reminders**: Trigger automated voice calls to patients who are late.
- **Safe Deletion**: Ability to clear test records or accidental check-ins from the activity log.

---

## 🛠 Developer & Security Features

### 🔑 Robust Authentication
- Secure Admin login with HTTP-only cookies and JWT session management.
- Environment-based credentials for all third-party services.

### 🧪 Debugging & Test Tools
- **Bypass Codes**: Known test codes (`123456`, `000000`) for rapid development logic testing.
- **Mock Payment**: Dev-only toggle to skip Square payment steps during testing.
- **Detailed Logging**: Comprehensive server-side logging for API interactions with Square and Google.
