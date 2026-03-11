'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCheckIn } from '@/contexts/CheckInContext';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Home, Printer, Mail, Phone, Calendar, ArrowRight, CreditCard } from 'lucide-react';

const RESET_SECONDS = 30;

export default function SuccessPage() {
    const router = useRouter();
    const { formData, appointment, paymentResult, checkInResult, resetAll, language } = useCheckIn();
    const [countdown, setCountdown] = useState(RESET_SECONDS);
    const [queueData, setQueueData] = useState<{ position: number; totalWaiting: number; estimatedWaitTime: number } | null>(null);

    // Redirect if no context
    useEffect(() => {
        if (!formData) {
            router.push('/');
        }
    }, [formData, router]);

    // Countdown timer
    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    resetAll();
                    router.push('/');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [resetAll, router]);

    // Fetch queue info
    useEffect(() => {
        if (!checkInResult?.patientId) return;
        const fetchStatus = async () => {
            try {
                const res = await fetch(`/api/queue?patientId=${checkInResult.patientId}`);
                if (res.ok) {
                    const data = await res.json();
                    setQueueData(data);
                }
            } catch (e) { 
                console.error('Queue fetch error', e); 
            }
        };
        fetchStatus();
    }, [checkInResult?.patientId]);

    const t_success = {
        en: {
            done: "Done",
            confirmed: "Visit Confirmed",
            title: "Check-In Successful",
            greeting: "Thank you,",
            reserved: "Your seat is reserved.",
            appointment: "Appointment",
            payment: "Payment",
            queue: "Queue Status",
            wait: "min wait",
            seat: "You may now take a seat in the waiting area.",
            return: "Return to Welcome",
            payAtFront: "Pay at Front Desk"
        },
        es: {
            done: "Listo",
            confirmed: "Visita Confirmada",
            title: "Registro Exitoso",
            greeting: "Gracias,",
            reserved: "Su asiento está reservado.",
            appointment: "Cita",
            payment: "Pago",
            queue: "Estado de la cola",
            wait: "min de espera",
            seat: "Ahora puede tomar asiento en el área de espera.",
            return: "Volver al inicio",
            payAtFront: "Pago en mostrador"
        }
    }[language];

    if (!formData) return null;

    const skippedPayment = !paymentResult;
    const copayAmount = parseInt(process.env.NEXT_PUBLIC_COPAY_AMOUNT_CENTS || '5000', 10);
    const copayDisplay = `$${(copayAmount / 100).toFixed(2)}`;

    const formatTime = (isoStr?: string) => {
        if (!isoStr) return 'Today';
        try {
            return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        } catch { return isoStr; }
    };

    const circumference = 2 * Math.PI * 40;
    const dashOffset = circumference * (1 - (countdown / RESET_SECONDS));

    return (
        <div className="min-h-screen premium-bg flex flex-col items-center">
            {/* Header */}
            <header className="w-full h-48 bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-blue-500/10 mix-blend-overlay" />
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="z-10 text-center">
                    <h1 className="text-4xl font-extrabold text-white tracking-tight uppercase">{t_success.done}</h1>
                    <p className="text-slate-400 mt-2 font-medium tracking-widest text-xs uppercase underline decoration-emerald-500 underline-offset-8">{t_success.confirmed}</p>
                </motion.div>
            </header>

            <main className="flex-1 w-full max-w-lg px-6 -mt-16 pb-20 z-20">
                <AnimatePresence mode="wait">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card p-10 text-center shadow-2xl relative overflow-hidden"
                    >
                        {/* Success Icon */}
                        <div className="relative w-24 h-24 mx-auto mb-8">
                            <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1.2, opacity: 0 }}
                                transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                                className="absolute inset-0 bg-emerald-500 rounded-full"
                            />
                            <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                                className="relative w-full h-full bg-emerald-600 rounded-full flex items-center justify-center shadow-xl shadow-emerald-600/20"
                            >
                                <CheckCircle2 className="text-white w-12 h-12" strokeWidth={2.5} />
                            </motion.div>
                        </div>

                        <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">{t_success.title}</h2>
                        <p className="text-slate-500 font-medium mb-10 leading-relaxed max-w-xs mx-auto">
                            {t_success.greeting} <span className="text-slate-900 font-bold">{formData.firstName}</span>. <br/> {t_success.reserved}
                        </p>

                        {/* Confirmation Card */}
                        <div className="bg-slate-50/50 border border-slate-200/60 rounded-3xl p-6 mb-10 text-left space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Calendar size={12} className="text-indigo-500" /> {t_success.appointment}</span>
                                <span className="text-sm font-bold text-slate-900">{formatTime(appointment?.startTime)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><CreditCard size={12} className="text-emerald-500" /> {t_success.payment}</span>
                                <span className={`text-sm font-bold ${skippedPayment ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {skippedPayment ? t_success.payAtFront : copayDisplay}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Home size={12} className="text-slate-500" /> {t_success.queue}
                                </span>
                                <span className="text-sm font-bold text-indigo-600">
                                    {queueData ? (
                                        `Position #${queueData.position} (${queueData.estimatedWaitTime} ${t_success.wait})`
                                    ) : (
                                        'Active in Queue'
                                    )}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-600 leading-tight italic">
                                    {t_success.seat}
                                </span>
                            </div>
                        </div>

                        {/* Return Timer */}
                        <div className="relative w-20 h-20 mx-auto group">
                            <svg width="80" height="80" viewBox="0 0 96 96" className="transform -rotate-90">
                                <circle cx="48" cy="48" r="40" fill="none" stroke="#f1f5f9" strokeWidth="6" />
                                <motion.circle
                                    cx="48"
                                    cy="48"
                                    r="40"
                                    fill="none"
                                    stroke="#e2e8f0"
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={dashOffset}
                                    transition={{ duration: 1, ease: "linear" }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-xl font-black text-slate-900 leading-none">{countdown}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">SEC</span>
                            </div>
                        </div>

                        <button
                            onClick={() => { resetAll(); router.push('/'); }}
                            className="w-full mt-10 flex items-center justify-center gap-2 py-4 border-2 border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                        >
                            {t_success.return} <ArrowRight size={14} />
                        </button>
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}
