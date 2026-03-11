'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCheckIn } from '@/contexts/CheckInContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBanner from '@/components/ErrorBanner';
import { Button } from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, ShieldCheck, DollarSign, ArrowLeft, Clock, User, CheckCircle2, AlertCircle } from 'lucide-react';

declare global {
    interface Window {
        Square?: {
            payments: (appId: string, locationId: string) => Promise<{
                card: () => Promise<{
                    attach: (selector: string) => Promise<void>;
                    tokenize: () => Promise<{ status: string; token: string; errors?: { message: string }[] }>;
                    destroy: () => void;
                }>;
            }>;
        };
    }
}

export default function PaymentPage() {
    const router = useRouter();
    const { formData, checkInResult, appointment, setPaymentResult } = useCheckIn();

    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sdkError, setSdkError] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cardRef = useRef<any>(null);

    const copayAmount = parseInt(process.env.NEXT_PUBLIC_COPAY_AMOUNT_CENTS || '5000', 10);
    const copayDisplay = `$${(copayAmount / 100).toFixed(2)}`;

    const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID || '';
    const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID || '';

    // Redirect if no context
    useEffect(() => {
        if (!formData || !checkInResult) {
            router.push('/');
        }
    }, [formData, checkInResult, router]);

    // Load Square SDK
    useEffect(() => {
        if (!appId || !locationId) {
            setSdkError(true);
            setLoading(false);
            return;
        }

        let isMounted = true;
        let localCard: any = null;

        const initSquare = async () => {
            try {
                if (!window.Square) throw new Error('Square SDK not loaded');
                if (!isMounted) return;

                const container = document.getElementById('card-container');
                if (container) container.innerHTML = '';

                const payments = await window.Square.payments(appId, locationId);
                const card = await payments.card();
                
                if (!isMounted) {
                    await card.destroy();
                    return;
                }

                await card.attach('#card-container');
                
                if (!isMounted) {
                    await card.destroy();
                    return;
                }

                cardRef.current = card;
                localCard = card;
                setLoading(false);
            } catch (err) {
                console.error('Square init error:', err);
                if (isMounted) {
                    setSdkError(true);
                    setLoading(false);
                }
            }
        };

        const isSandbox = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT !== 'production';
        const scriptUrl = isSandbox
            ? 'https://sandbox.web.squarecdn.com/v1/square.js'
            : 'https://web.squarecdn.com/v1/square.js';

        if (window.Square) {
            initSquare();
        } else {
            let script = document.querySelector(`script[src="${scriptUrl}"]`) as HTMLScriptElement;
            if (!script) {
                script = document.createElement('script');
                script.src = scriptUrl;
                document.head.appendChild(script);
            }

            const onScriptLoad = () => { if (isMounted) initSquare(); };
            const onScriptError = () => { if (isMounted) { setSdkError(true); setLoading(false); } };
            
            script.addEventListener('load', onScriptLoad);
            script.addEventListener('error', onScriptError);
        }

        return () => {
            isMounted = false;
            if (cardRef.current) {
                try {
                    cardRef.current.destroy();
                    cardRef.current = null;
                } catch { /* ignore */ }
            } else if (localCard) {
                try { localCard.destroy(); } catch { /* ignore */ }
            }
        };
    }, [appId, locationId]);

    const handlePay = async () => {
        if (!cardRef.current || processing || !formData || !checkInResult) return;

        setProcessing(true);
        setError(null);

        try {
            const result = await cardRef.current.tokenize();
            if (result.status !== 'OK') {
                const errMsg = result.errors?.[0]?.message || 'Invalid card details.';
                throw new Error(errMsg);
            }

            const res = await fetch('/api/payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceId: result.token,
                    amount: copayAmount,
                    patientEmail: formData.email,
                    patientName: `${formData.firstName} ${formData.lastName}`,
                    patientId: checkInResult.patientId,
                    patientPhone: formData.phone,
                    reason: formData.reasonForVisit,
                    appointmentTime: appointment?.startTime,
                }),
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Payment failed.');

            setPaymentResult({
                success: true,
                paymentId: data.paymentId,
                receiptUrl: data.receiptUrl,
                transactionId: data.transactionId,
            });

            router.push('/success');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Payment failed.');
            setProcessing(false);
        }
    };

    if (!formData || !checkInResult) return null;

    const formatTime = (isoStr?: string) => {
        if (!isoStr) return 'Today';
        try {
            return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        } catch { return isoStr; }
    };

    if (processing) return <LoadingSpinner text="Securing transaction..." fullPage />;

    return (
        <div className="min-h-screen premium-bg flex flex-col items-center">
            {/* Header */}
            <header className="w-full h-48 bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-blue-500/10 mix-blend-overlay" />
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="z-10 text-center">
                    <h1 className="text-4xl font-extrabold text-white tracking-tight uppercase">Pay</h1>
                    <p className="text-slate-400 mt-2 font-medium tracking-widest text-xs uppercase underline decoration-indigo-500 underline-offset-8">Secure Checkout</p>
                </motion.div>
            </header>

            <main className="flex-1 w-full max-w-lg px-6 -mt-16 pb-20 z-20">
                <AnimatePresence mode="wait">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card shadow-2xl overflow-hidden"
                    >
                        {error && <div className="p-6 pb-0"><ErrorBanner message={error} showStartOver={false} /></div>}

                        {/* Order Summary */}
                        <div className="p-8 pb-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <ShieldCheck size={14} className="text-emerald-500" /> Order Summary
                            </h3>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors"><User size={14} /></div>
                                        <span className="text-sm font-medium text-slate-500">Patient</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-900">{formData.firstName} {formData.lastName}</span>
                                </div>
                                
                                <div className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors"><Clock size={14} /></div>
                                        <span className="text-sm font-medium text-slate-500">Time</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-900">{formatTime(appointment?.startTime)}</span>
                                </div>
                            </div>

                            <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm"><DollarSign size={20} /></div>
                                    <span className="text-sm font-bold text-slate-900">Total Due</span>
                                </div>
                                <span className="text-4xl font-black text-slate-900 tracking-tighter">{copayDisplay}</span>
                            </div>
                        </div>

                        {/* Square Form */}
                        <div className="bg-slate-50/50 px-8 py-10 border-t border-slate-100">
                            {sdkError ? (
                                <div className="space-y-4">
                                    <div className="p-6 bg-white border border-red-100 rounded-3xl text-center shadow-sm">
                                        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" strokeWidth={1.5} />
                                        <p className="text-slate-900 font-bold mb-1">Payment Unavailable</p>
                                        <p className="text-slate-500 text-xs">
                                            Our card terminal is not available right now. You can still check in and pay at the front desk.
                                        </p>
                                    </div>
                                    <Button
                                        fullWidth
                                        variant="ghost"
                                        onClick={() => router.push('/success')}
                                        aria-label="Skip card payment and see front desk"
                                    >
                                        <span className="flex items-center gap-2">
                                            <ArrowLeft size={16} /> Skip card, pay at front desk
                                        </span>
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-8">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Card Information</label>
                                        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/5 transition-all shadow-sm">
                                            {loading && <LoadingSpinner text="Starting secure form..." />}
                                            <div id="card-container" className={loading ? 'hidden' : ''} style={{ minHeight: 40 }} />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handlePay}
                                        disabled={loading || processing}
                                        className={`w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-bold text-lg transition-all active:scale-95 ${
                                            loading || processing
                                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xl shadow-emerald-600/10'
                                        }`}
                                    >
                                        <CreditCard size={20} /> Pay Now
                                    </button>
                                </>
                            )}

                            <button
                                onClick={() => router.push('/appointment')}
                                className="w-full mt-8 flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 font-bold text-[10px] uppercase tracking-widest transition-colors"
                            >
                                <ArrowLeft size={12} /> Back to Appointment
                            </button>

                            {/* Dev-mode payment bypass */}
                            {process.env.NODE_ENV === 'development' && (
                                <button
                                    onClick={() => {
                                        setPaymentResult({
                                            success: true,
                                            paymentId: 'DEV-BYPASS-' + Date.now(),
                                            receiptUrl: '',
                                            transactionId: 'DEV-TXN-' + Date.now(),
                                        });
                                        router.push('/success');
                                    }}
                                    className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-amber-100 text-amber-800 border-2 border-amber-300 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-amber-200 transition-all"
                                >
                                    🧪 Dev: Skip Payment
                                </button>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}

