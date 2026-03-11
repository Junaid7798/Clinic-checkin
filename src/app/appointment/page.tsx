'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCheckIn, AppointmentInfo } from '@/contexts/CheckInContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBanner from '@/components/ErrorBanner';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, CheckCircle2, ChevronRight, AlertCircle, MapPin } from 'lucide-react';

interface SlotInfo {
    time: string;
    display: string;
    available: boolean;
}

export default function AppointmentPage() {
    const router = useRouter();
    const { formData, checkInResult, setAppointment } = useCheckIn();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [foundAppointment, setFoundAppointment] = useState<AppointmentInfo | null>(null);
    const [showSlots, setShowSlots] = useState(false);
    const [slots, setSlots] = useState<SlotInfo[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [booking, setBooking] = useState(false);
    const [canceling, setCanceling] = useState(false);
    const [clinicClosed, setClinicClosed] = useState(false);

    // Redirect if no context
    useEffect(() => {
        if (!formData || !checkInResult) {
            router.push('/');
        }
    }, [formData, checkInResult, router]);

    // Fetch appointment on mount
    const fetchAppointment = useCallback(async () => {
        if (!formData) return;

        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await fetch(`/api/appointments?email=${encodeURIComponent(formData.email)}&date=${today}`);
            const data = await res.json();

            if (data.found && data.appointment) {
                setFoundAppointment(data.appointment);
            } else {
                setShowSlots(true);
                await fetchSlots();
            }
        } catch {
            setShowSlots(true);
            await fetchSlots();
        } finally {
            setLoading(false);
        }
    }, [formData]);

    const fetchSlots = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await fetch(`/api/slots?date=${today}`);
            const data = await res.json();
            setSlots(data.slots || []);
            setClinicClosed(!!data.closed);
            if (res.status >= 500 || data.reason === 'FALLBACK') {
                setError('We are having trouble loading real-time availability. Please see the front desk if you need help.');
            }
        } catch (err) {
            console.error('Failed to load slots:', err);
            setError('We could not load availability. Please see the front desk.');
        }
    };

    useEffect(() => {
        fetchAppointment();
    }, [fetchAppointment]);

    const formatTime = (isoStr: string) => {
        try {
            return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        } catch {
            return isoStr;
        }
    };

    const handleConfirmAppointment = () => {
        if (foundAppointment) {
            setAppointment(foundAppointment);
            router.push('/payment');
        }
    };

    const handleBookSlot = async () => {
        if (!selectedSlot || !formData || !checkInResult) return;

        setBooking(true);
        setError(null);

        try {
            const today = new Date().toISOString().split('T')[0];
            const startTime = `${today}T${selectedSlot}:00`;

            const res = await fetch('/api/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientName: `${formData.firstName} ${formData.lastName}`,
                    email: formData.email,
                    phone: formData.phone,
                    startTime,
                    reason: formData.reasonForVisit,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not book appointment.');

            setAppointment({
                source: 'google-calendar',
                title: `Appointment Selection`,
                startTime: data.startTime,
                endTime: data.endTime,
                location: 'Clinic',
                eventId: data.eventId,
            });

            router.push('/payment');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Booking failed.');
        } finally {
            setBooking(false);
        }
    };

    const handleCancelAppointment = async () => {
        if (!foundAppointment || !formData) return;
        
        if (!confirm('Are you sure you want to cancel your existing appointment?')) return;

        setCanceling(true);
        setError(null);

        try {
            const res = await fetch('/api/appointments/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: foundAppointment.eventId,
                    source: foundAppointment.source,
                    email: formData.email
                }),
            });

            if (!res.ok) throw new Error('Could not cancel appointment.');

            setFoundAppointment(null);
            setShowSlots(true);
            await fetchSlots();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Cancellation failed.');
        } finally {
            setCanceling(false);
        }
    };

    if (!formData || !checkInResult) return null;
    if (loading) return <LoadingSpinner text="Consulting schedule..." fullPage />;
    if (booking) return <LoadingSpinner text="Finalizing booking..." fullPage />;
    if (canceling) return <LoadingSpinner text="Canceling appointment..." fullPage />;

    const availableSlots = slots.filter((s) => s.available);

    return (
        <div className="min-h-screen premium-bg flex flex-col items-center">
            {/* Header */}
            <header className="w-full h-48 bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-blue-500/10 mix-blend-overlay" />
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="z-10 text-center">
                    <h1 className="text-4xl font-extrabold text-white tracking-tight uppercase">Visit</h1>
                    <p className="text-slate-400 mt-2 font-medium tracking-widest text-xs uppercase underline decoration-indigo-500 underline-offset-8">Time Selection</p>
                </motion.div>
            </header>

            <main className="flex-1 w-full max-w-2xl px-6 -mt-16 pb-20 z-20">
                <AnimatePresence mode="wait">
                    {error && (
                        <div className="mb-4">
                            <ErrorBanner message={error} showStartOver={false} />
                        </div>
                    )}
                    {/* Scenario A: Appointment Found */}
                    {foundAppointment && !showSlots && (
                        <motion.div
                            key="found"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass-card p-10 shadow-2xl overflow-hidden"
                        >
                            <div className="text-center mb-10">
                                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 flex items-center justify-center border-2 border-emerald-100/50">
                                    <Calendar className="w-10 h-10 text-emerald-600" />
                                </div>
                                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Appointment Found</h2>
                                <p className="text-slate-500 mt-2 font-medium">We found your record in the system.</p>
                            </div>

                            <div className="bg-slate-50/50 border border-slate-200/60 rounded-3xl p-8 mb-10">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-500"><Clock size={22} /></div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reserved Time</p>
                                            <p className="text-lg font-bold text-slate-900">
                                                {formatTime(foundAppointment.startTime)} — {formatTime(foundAppointment.endTime)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white rounded-2xl shadow-sm text-emerald-500"><MapPin size={22} /></div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location</p>
                                            <p className="text-lg font-bold text-slate-900">{foundAppointment.location}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleConfirmAppointment}
                                className="w-full flex items-center justify-center gap-3 py-5 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 shadow-xl shadow-emerald-600/10 transition-all active:scale-95"
                            >
                                <CheckCircle2 size={22} /> Confirm & Continue
                            </button>

                            <button
                                onClick={() => { setShowSlots(true); fetchSlots(); }}
                                className="w-full mt-8 text-indigo-600 hover:text-indigo-800 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                            >
                                Change my time slot →
                            </button>

                            <button
                                onClick={handleCancelAppointment}
                                className="w-full mt-4 text-red-400 hover:text-red-600 text-[10px] font-bold uppercase tracking-widest transition-colors"
                            >
                                Cancel this appointment
                            </button>
                        </motion.div>
                    )}

                    {/* Scenario B: Select a Slot */}
                    {showSlots && availableSlots.length > 0 && !clinicClosed && (
                        <motion.div
                            key="slots"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass-card p-10 shadow-2xl"
                        >
                            <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight text-center">
                                Select Your Time
                            </h2>
                            <p className="text-slate-500 text-center mb-10 font-medium tracking-wide">
                                Available appointments for today (clinic local time):
                            </p>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
                                {slots.map((slot) => (
                                    <button
                                        key={slot.time}
                                        disabled={!slot.available}
                                        onClick={() => slot.available && setSelectedSlot(slot.time)}
                                        className={`py-5 px-4 rounded-2xl font-bold text-base transition-all ${
                                            !slot.available
                                                ? 'bg-slate-100/50 text-slate-300 cursor-not-allowed opacity-50'
                                                : selectedSlot === slot.time
                                                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 scale-[1.02]'
                                                    : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-indigo-500/50 hover:bg-indigo-50/50'
                                        }`}
                                    >
                                        <div className="flex flex-col items-center">
                                            <span className="text-sm">{slot.display.split(' ')[0]}</span>
                                            <span className="text-[10px] uppercase opacity-60 tracking-tighter">{slot.display.split(' ')[1]}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleBookSlot}
                                disabled={!selectedSlot}
                                className={`w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-bold text-lg transition-all active:scale-95 ${
                                    selectedSlot
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-600/10'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                Continue <ChevronRight size={22} className={selectedSlot ? 'text-white/70' : 'text-slate-400'} />
                            </button>
                        </motion.div>
                    )}

                    {/* Scenario C: No Slots Available or Clinic Closed */}
                    {showSlots && (availableSlots.length === 0 || clinicClosed) && !loading && (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="glass-card p-12 text-center shadow-2xl"
                        >
                            <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-orange-50 flex items-center justify-center border-2 border-orange-100/50">
                                <AlertCircle className="w-12 h-12 text-orange-500" />
                            </div>
                            <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
                                {clinicClosed ? 'Clinic Closed' : 'Fully Booked'}
                            </h2>
                            <p className="text-slate-500 font-medium mb-10 leading-relaxed max-w-xs mx-auto text-lg">
                                {clinicClosed 
                                    ? `The clinic is currently closed for the day. Please return during business hours (9 AM - 5 PM).`
                                    : `We are sorry, but all slots for today are currently taken.`}
                            </p>
                            <button
                                onClick={() => router.push('/')}
                                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-900/10"
                            >
                                Return to Start
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
