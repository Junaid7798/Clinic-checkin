import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials, createSessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json(
                { error: 'Username and password are required.' },
                { status: 400 }
            );
        }

        if (!validateCredentials(username, password)) {
            return NextResponse.json(
                { error: 'Invalid credentials.' },
                { status: 401 }
            );
        }

        const token = createSessionToken(username);

        const response = NextResponse.json({ success: true });

        response.cookies.set(ADMIN_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 8 * 60 * 60, // 8 hours
        });

        return response;
    } catch (error) {
        console.error('[API /admin/login] Error:', error);
        return NextResponse.json(
            { error: 'Login failed.' },
            { status: 500 }
        );
    }
}
