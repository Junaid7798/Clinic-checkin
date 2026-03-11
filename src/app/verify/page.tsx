'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCheckIn } from '@/contexts/CheckInContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBanner from '@/components/ErrorBanner';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, RefreshCw, ArrowLeft } from 'lucide-react';

export default function VerifyPage() {
    const router = useRouter();
    const { formData, requestId, setRequestId, setCheckInResult } = useCheckIn();

    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attempts, setAttempts] = useState(3);
    const [resendCooldown, setResendCooldown] = useState(60);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Redirect if no context
    useEffect(() => {
        if (!formData || !requestId) {
            router.push('/');
        }
    }, [formData, requestId, router]);

    // Auto-focus first input
    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    // Resend cooldown timer
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => {
            setResendCooldown((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const handleDigitChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newCode = [...code];
        newCode[index] = value.slice(-1);
        setCode(newCode);

        // Auto-advance
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when complete
        if (value && index === 5 && newCode.every((d) => d !== '')) {
            submitCode(newCode.join(''));
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newCode = [...code];
        pasted.split('').forEach((d, i) => {
            newCode[i] = d;
        });
        setCode(newCode);
        if (pasted.length === 6) {
            submitCode(pasted);
        } else {
            inputRefs.current[Math.min(pasted.length, 5)]?.focus();
        }
    };

    const submitCode = useCallback(async (codeStr: string) => {
        if (!requestId || !formData) return;
        setLoading(true);
        setError(null);

        try {
            const verifyRes = await fetch('/api/verify/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, code: codeStr }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyData.verified) {
                const remainingAttempts = attempts - 1;
                setAttempts(remainingAttempts);

                if (remainingAttempts <= 0) {
                    setError('Verification failed. Please see the front desk.');
                } else {
                    setError(`Incorrect code. ${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} remaining.`);
                    setCode(['', '', '', '', '', '']);
                    inputRefs.current[0]?.focus();
                }
                setLoading(false);
                return;
            }

            const checkinRes = await fetch('/api/checkin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const checkinData = await checkinRes.json();
            if (!checkinRes.ok) throw new Error(checkinData.error || 'Check-in failed.');

            setCheckInResult(checkinData);
            router.push('/appointment');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please see the front desk.');
            setLoading(false);
        }
    }, [requestId, formData, attempts, setCheckInResult, router]);

    const handleResend = async () => {
        if (resendCooldown > 0 || !formData) return;
        setLoading(true);
        setError(null);

        try {
            const phoneToSend = formData.phone.length === 10 ? '+1' + formData.phone : '+' + formData.phone;
            const res = await fetch('/api/verify/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phoneToSend }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setRequestId(data.requestId);
            setResendCooldown(60);
            setAttempts(3);
            setCode(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to resend code.');
        } finally {
            setLoading(false);
        }
    };

    if (!formData || !requestId) return null;

    const maskedPhone = formData.phone.length >= 4 ? `(***) ***-${formData.phone.slice(-4)}` : '****';

    if (loading) return <LoadingSpinner text="Securing session..." fullPage />;

    return (
        <div className="min-h-screen premium-bg flex flex-col items-center">
             {/* Header */}
             <header className="w-full h-48 bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-blue-500/10 mix-blend-overlay" />
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="z-10 text-center">
                    <h1 className="text-4xl font-extrabold text-white tracking-tight uppercase">Verify</h1>
                    <p className="text-slate-400 mt-2 font-medium tracking-widest text-xs uppercase underline decoration-indigo-500 underline-offset-8">Identity Check</p>
                </motion.div>
            </header>

            <main className="flex-1 w-full max-w-lg px-6 -mt-16 pb-20 z-20">
                <AnimatePresence mode="wait">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card p-10 text-center shadow-2xl relative overflow-hidden"
                    >
                        {error && <div className="mb-6"><ErrorBanner message={error} showStartOver={attempts <= 0} /></div>}

                        {attempts > 0 && (
                            <>
                                <div className="w-20 h-20 mx-auto mb-8 relative" aria-hidden="true">
                                    <div className="absolute inset-0 bg-indigo-500/10 rounded-full animate-ping" />
                                    <div className="relative rounded-full bg-indigo-50 w-full h-full flex items-center justify-center border-2 border-indigo-100/50">
                                        <Lock className="w-8 h-8 text-indigo-600" />
                                    </div>
                                </div>

                                <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Enter Code</h2>
                                <p className="text-slate-500 text-sm mb-10 font-medium">
                                    We've sent a 6-digit verification code to <br/>
                                    <span className="text-slate-900 font-bold">{maskedPhone}</span>
                                </p>

                                {/* OTP Boxes */}
                                <div
                                    className="flex justify-center gap-2.5 mb-10"
                                    onPaste={handlePaste}
                                    aria-label="Enter the 6-digit verification code"
                                    role="group"
                                >
                                    {code.map((digit, i) => (
                                        <input
                                            key={i}
                                            ref={(el) => { inputRefs.current[i] = el; }}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            className="w-12 h-16 sm:w-14 sm:h-20 text-center text-3xl font-bold border-2 border-slate-200 bg-white/50 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                                            value={digit}
                                            onChange={(e) => handleDigitChange(i, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(i, e)}
                                        />
                                    ))}
                                </div>

                                {/* Actions */}
                                <div className="space-y-6">
                                    <div>
                                        {resendCooldown > 0 ? (
                                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                                                Resend available in <span className="text-indigo-600">{resendCooldown}s</span>
                                            </p>
                                        ) : (
                                            <button onClick={handleResend} className="flex items-center gap-2 mx-auto text-indigo-600 font-bold hover:text-indigo-700 transition-colors uppercase tracking-widest text-xs">
                                                <RefreshCw size={14} /> Resend New Code
                                            </button>
                                        )}
                                    </div>

                                    <div className="pt-4 border-t border-slate-100">
                                        <button
                                            onClick={() => router.push('/')}
                                            className="flex items-center gap-2 mx-auto px-6 py-2 text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase tracking-widest text-[10px]"
                                        >
                                            <ArrowLeft size={14} /> Incorrect Phone? Go Back
                                        </button>
                                    </div>

                                    {/* Dev-mode OTP bypass */}
                                    {process.env.NODE_ENV === 'development' && (
                                        <div className="pt-2">
                                            <button
                                                onClick={() => {
                                                    const testCode = ['0','0','0','0','0','0'];
                                                    setCode(testCode);
                                                    submitCode('000000');
                                                }}
                                                className="flex items-center gap-2 mx-auto px-6 py-2 bg-amber-100 text-amber-800 border-2 border-amber-300 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-amber-200 transition-all"
                                            >
                                                🧪 Dev: Auto-verify (000000)
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}

