'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCheckIn } from '@/contexts/CheckInContext';

const IDLE_WARNING_SECONDS = 90;
const IDLE_RESET_SECONDS = 120;

export default function KioskWrapper({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { resetAll } = useCheckIn();
    const lastInteraction = useRef(0);
    const [showWarning, setShowWarning] = useState(false);
    const [countdown, setCountdown] = useState(30);

    const handleInteraction = useCallback(() => {
        lastInteraction.current = Date.now();
        if (showWarning) {
            setShowWarning(false);
            setCountdown(30);
        }
    }, [showWarning]);

    // Initialize lastInteraction on mount
    useEffect(() => {
        lastInteraction.current = Date.now();
    }, []);

    useEffect(() => {
        const events = ['touchstart', 'click', 'keypress', 'mousemove'];
        events.forEach((e) => window.addEventListener(e, handleInteraction));
        return () => events.forEach((e) => window.removeEventListener(e, handleInteraction));
    }, [handleInteraction]);

    useEffect(() => {
        const interval = setInterval(() => {
            const elapsed = (Date.now() - lastInteraction.current) / 1000;

            if (elapsed >= IDLE_RESET_SECONDS) {
                resetAll();
                router.push('/');
                setShowWarning(false);
                setCountdown(30);
                lastInteraction.current = Date.now();
            } else if (elapsed >= IDLE_WARNING_SECONDS) {
                setShowWarning(true);
                setCountdown(Math.max(0, Math.ceil(IDLE_RESET_SECONDS - elapsed)));
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [resetAll, router]);

    // Prevent right-click
    useEffect(() => {
        const handler = (e: MouseEvent) => e.preventDefault();
        window.addEventListener('contextmenu', handler);
        return () => window.removeEventListener('contextmenu', handler);
    }, []);

    return (
        <div className="min-h-screen relative">
            {children}

            {/* Idle warning overlay */}
            {showWarning && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Idle session warning"
                    onClick={handleInteraction}
                >
                    <div className="bg-white rounded-2xl p-10 max-w-md mx-4 text-center shadow-2xl animate-fade-in">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Are you still there?</h2>
                        <p className="text-gray-600 text-lg mb-6">
                            Tap anywhere to continue. This session will reset in{' '}
                            <span className="font-bold text-amber-600">{countdown}</span> seconds.
                        </p>
                        <button
                            onClick={handleInteraction}
                            className="px-8 py-4 bg-[#1A5276] text-white rounded-xl text-lg font-semibold hover:bg-[#154360] active:bg-[#0F2D40] transition-colors min-h-[56px]"
                        >
                            I&apos;m Still Here
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
