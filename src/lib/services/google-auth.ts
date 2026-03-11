import { google } from 'googleapis';

// Shared Google OAuth2 client singleton
let authClient: InstanceType<typeof google.auth.JWT> | null = null;

export function getGoogleAuth() {
    if (authClient) return authClient;

    const rawKey = process.env.GOOGLE_PRIVATE_KEY;
    const privateKey = rawKey ? rawKey.replace(/\\n/g, '\n').replace(/"/g, '') : undefined;

    authClient = new google.auth.JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL,
        key: privateKey,
        scopes: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/spreadsheets',
        ],
    });

    return authClient;
}
