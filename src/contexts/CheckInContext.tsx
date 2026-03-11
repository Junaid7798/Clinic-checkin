'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────
export interface PatientFormData {
    firstName: string;
    lastName: string;
    dob: string;
    phone: string;
    email: string;
    insuranceProvider: string;
    insurancePolicyNumber: string;
    reasonForVisit: string;
    currentMedications: string;
    allergies: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
}

export interface CheckInResult {
    patientId: string;
    isNew: boolean;
    changesDetected: boolean;
    changes: { field: string; oldValue: string; newValue: string }[];
}

export interface AppointmentInfo {
    source: string;
    title: string;
    startTime: string;
    endTime: string;
    location: string;
    eventId?: string;
}

export interface PaymentResult {
    success: boolean;
    paymentId: string;
    receiptUrl: string;
    transactionId: string;
}

interface CheckInContextType {
    // Form data
    formData: PatientFormData | null;
    setFormData: (data: PatientFormData) => void;

    // OTP
    requestId: string | null;
    setRequestId: (id: string) => void;

    // Check-in result
    checkInResult: CheckInResult | null;
    setCheckInResult: (result: CheckInResult) => void;

    // Appointment
    appointment: AppointmentInfo | null;
    setAppointment: (apt: AppointmentInfo | null) => void;

    // Payment
    paymentResult: PaymentResult | null;
    setPaymentResult: (result: PaymentResult) => void;

    // Language
    language: 'en' | 'es';
    setLanguage: (lang: 'en' | 'es') => void;

    // Reset
    resetAll: () => void;
}

const CheckInContext = createContext<CheckInContextType | null>(null);

export function CheckInProvider({ children }: { children: React.ReactNode }) {
    const [formData, setFormDataState] = useState<PatientFormData | null>(null);
    const [requestId, setRequestIdState] = useState<string | null>(null);
    const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null);
    const [appointment, setAppointment] = useState<AppointmentInfo | null>(null);
    const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
    const [language, setLanguageState] = useState<'en' | 'es'>('en');

    // Initialize from sessionStorage on mount (client-side only)
    React.useEffect(() => {
        try {
            const storedFormData = sessionStorage.getItem('checkin_formData');
            if (storedFormData) setFormDataState(JSON.parse(storedFormData));
            
            const storedRequestId = sessionStorage.getItem('checkin_requestId');
            if (storedRequestId) setRequestIdState(storedRequestId);

            const storedLanguage = sessionStorage.getItem('checkin_language');
            if (storedLanguage === 'en' || storedLanguage === 'es') setLanguageState(storedLanguage);
        } catch (e) {
            console.error('Failed to parse session storage CheckIn context', e);
        }
    }, []);

    const setFormData = useCallback((data: PatientFormData) => {
        setFormDataState(data);
        sessionStorage.setItem('checkin_formData', JSON.stringify(data));
    }, []);

    const setRequestId = useCallback((id: string) => {
        setRequestIdState(id);
        sessionStorage.setItem('checkin_requestId', id);
    }, []);

    const setLanguage = useCallback((lang: 'en' | 'es') => {
        setLanguageState(lang);
        sessionStorage.setItem('checkin_language', lang);
    }, []);

    const resetAll = useCallback(() => {
        setFormDataState(null);
        setRequestIdState(null);
        setCheckInResult(null);
        setAppointment(null);
        setPaymentResult(null);
        sessionStorage.removeItem('checkin_formData');
        sessionStorage.removeItem('checkin_requestId');
    }, []);

    return (
        <CheckInContext.Provider
            value={{
                formData,
                setFormData,
                requestId,
                setRequestId,
                checkInResult,
                setCheckInResult,
                appointment,
                setAppointment,
                paymentResult,
                setPaymentResult,
                language,
                setLanguage,
                resetAll,
            }}
        >
            {children}
        </CheckInContext.Provider>
    );
}

export function useCheckIn() {
    const context = useContext(CheckInContext);
    if (!context) {
        throw new Error('useCheckIn must be used within a CheckInProvider');
    }
    return context;
}
