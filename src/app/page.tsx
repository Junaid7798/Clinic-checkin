'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCheckIn } from '@/contexts/CheckInContext';
import ProgressBar from '@/components/ProgressBar';
import ErrorBanner from '@/components/ErrorBanner';
import { Button } from '@/components/ui';
import LoadingSpinner from '@/components/LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import { User, ShieldCheck, Stethoscope, PhoneCall, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { translations } from '@/lib/translations';

const VISIT_REASONS = [
  'Routine Eye Exam',
  'Contact Lens Fitting',
  'Follow-Up Visit',
  'Emergency/Urgent',
  'Glasses Prescription',
  'LASIK Consultation',
  'Other',
];

export default function CheckInPage() {
  const router = useRouter();
  const { setFormData, setRequestId, language, setLanguage } = useCheckIn();
  const t = translations[language];

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [allergies, setAllergies] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  const [isClient, setIsClient] = useState(false);

  // Load drafted form on mount
  useEffect(() => {
    setIsClient(true);
    try {
      const saved = localStorage.getItem('eyecare_checkin_draft');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.step && data.step <= 4) setStep(data.step);
        if (data.firstName) setFirstName(data.firstName);
        if (data.lastName) setLastName(data.lastName);
        if (data.dob) setDob(data.dob);
        if (data.phone) setPhone(data.phone);
        if (data.email) setEmail(data.email);
        if (data.insuranceProvider) setInsuranceProvider(data.insuranceProvider);
        if (data.insurancePolicyNumber) setInsurancePolicyNumber(data.insurancePolicyNumber);
        if (data.reasonForVisit) setReasonForVisit(data.reasonForVisit);
        if (data.currentMedications) setCurrentMedications(data.currentMedications);
        if (data.allergies) setAllergies(data.allergies);
        if (data.emergencyContactName) setEmergencyContactName(data.emergencyContactName);
        if (data.emergencyContactPhone) setEmergencyContactPhone(data.emergencyContactPhone);
      }
    } catch (e) {
      console.error('Failed to parse drafted form data', e);
    }
  }, []);

  // Save draft when data changes
  useEffect(() => {
    if (!isClient) return;
    const data = {
      step, firstName, lastName, dob, phone, email,
      insuranceProvider, insurancePolicyNumber,
      reasonForVisit, currentMedications, allergies,
      emergencyContactName, emergencyContactPhone
    };
    localStorage.setItem('eyecare_checkin_draft', JSON.stringify(data));
  }, [isClient, step, firstName, lastName, dob, phone, email, insuranceProvider, insurancePolicyNumber, reasonForVisit, currentMedications, allergies, emergencyContactName, emergencyContactPhone]);

  // Auto-focus first input on step change
  const stepContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      const firstInput = stepContainerRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>('input, select, textarea');
      firstInput?.focus();
    }, 350); // wait for framer-motion animation
    return () => clearTimeout(timer);
  }, [step]);

  // Phone number auto-formatting
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  // Validation per step
  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (firstName.trim().length < 2) return language === 'es' ? 'El nombre debe tener al menos 2 caracteres.' : 'First name must be at least 2 characters.';
      if (lastName.trim().length < 2) return language === 'es' ? 'El apellido debe tener al menos 2 caracteres.' : 'Last name must be at least 2 characters.';
      if (!dob) return language === 'es' ? 'La fecha de nacimiento es obligatoria.' : 'Date of birth is required.';
      const dobDate = new Date(dob);
      const age = (Date.now() - dobDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 0 || age > 120) return language === 'es' ? 'Por favor, introduce una fecha de nacimiento válida.' : 'Please enter a valid date of birth.';
      if (dobDate > new Date()) return language === 'es' ? 'La fecha de nacimiento debe ser en el pasado.' : 'Date of birth must be in the past.';
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 10 || phoneDigits.length > 15) return language === 'es' ? 'El teléfono debe tener 10-15 dígitos.' : 'Phone number must be 10-15 digits.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return language === 'es' ? 'Correo electrónico no válido.' : 'Please enter a valid email address.';
    }
    if (s === 3) {
      if (!reasonForVisit) return language === 'es' ? 'Seleccione el motivo de su visita.' : 'Please select a reason for your visit.';
    }
    if (s === 4) {
      const ecPhone = emergencyContactPhone.replace(/\D/g, '');
      if (ecPhone.length > 0 && !emergencyContactName.trim()) {
        return language === 'es' ? 'Ingrese un nombre para el contacto de emergencia.' : 'Please enter a name for the emergency contact.';
      }
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep(step + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setLoading(true);

    const formData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob,
      phone: phone.replace(/\D/g, ''),
      email: email.trim().toLowerCase(),
      insuranceProvider: insuranceProvider.trim() || 'Self-Pay',
      insurancePolicyNumber: insurancePolicyNumber.trim(),
      reasonForVisit,
      currentMedications: currentMedications.trim() || 'None',
      allergies: allergies.trim() || 'None',
      emergencyContactName: emergencyContactName.trim(),
      emergencyContactPhone: emergencyContactPhone.replace(/\D/g, ''),
    };

    try {
      const phoneToSend = formData.phone.length === 10 ? '+1' + formData.phone : '+' + formData.phone;
      const res = await fetch('/api/verify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneToSend }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send verification code.');

      setFormData(formData);
      setRequestId(data.requestId);
      localStorage.removeItem('eyecare_checkin_draft'); // Clear draft on success
      router.push('/verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : (language === 'es' ? 'No se pudo conectar.' : 'Unable to connect.'));
    } finally {
      setLoading(false);
    }
  };

  const LanguageToggle = () => (
    <div className="absolute top-6 right-6 z-30 flex gap-2">
      <button 
        onClick={() => setLanguage('en')}
        className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest transition-all ${
          language === 'en' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
        }`}
      >
        EN
      </button>
      <button 
        onClick={() => setLanguage('es')}
        className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest transition-all ${
          language === 'es' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
        }`}
      >
        ES
      </button>
    </div>
  );

  if (loading) return <LoadingSpinner text={language === 'es' ? 'Enviando código...' : 'Sending verification code...'} fullPage />;

  return (
    <div className="min-h-screen premium-bg flex flex-col items-center">
      <header className="w-full h-72 bg-slate-900 flex flex-col items-center justify-start pt-16 relative overflow-hidden">
        <LanguageToggle />
        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-blue-500/10 mix-blend-overlay" />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="z-10 text-center"
        >
          <h1 className="text-4xl font-extrabold text-white tracking-tight sm:text-5xl uppercase">{t.title}</h1>
          <p className="text-slate-400 mt-2 font-medium tracking-widest text-xs uppercase">{t.subtitle}</p>
        </motion.div>
      </header>

      <main className="flex-1 w-full max-w-2xl px-6 -mt-24 pb-20 z-20">
        <ProgressBar currentStep={step} />

        <div className="glass-card p-8 sm:p-10 relative overflow-hidden backdrop-blur-2xl">
          {error && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mb-6">
              <ErrorBanner message={error} showStartOver={false} />
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              ref={stepContainerRef}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {step === 1 && (
                <>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><User size={20} /></div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t.personalInfo.title}</h2>
                  </div>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="premium-label" htmlFor="first-name">{t.personalInfo.firstName}</label>
                        <input
                          id="first-name"
                          type="text"
                          aria-required="true"
                          className="premium-input"
                          placeholder="John"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="premium-label" htmlFor="last-name">{t.personalInfo.lastName}</label>
                        <input
                          id="last-name"
                          type="text"
                          aria-required="true"
                          className="premium-input"
                          placeholder="Doe"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="premium-label" htmlFor="dob">{t.personalInfo.dob}</label>
                      <input
                        id="dob"
                        type="date"
                        aria-required="true"
                        className="premium-input"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        />
                    </div>
                    <div>
                      <label className="premium-label" htmlFor="phone">{t.personalInfo.phone}</label>
                      <input
                        id="phone"
                        type="tel"
                        aria-required="true"
                        className="premium-input"
                        placeholder="(555) 123-4567"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="premium-label" htmlFor="email">{t.personalInfo.email}</label>
                      <input
                        id="email"
                        type="email"
                        className="premium-input"
                        placeholder="john.doe@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><ShieldCheck size={20} /></div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t.insurance.title}</h2>
                  </div>
                  <p className="text-slate-500 text-sm mb-8 font-medium">{t.insurance.description}</p>
                  <div className="space-y-6">
                    <div>
                      <label className="premium-label" htmlFor="insurance-provider">{t.insurance.provider}</label>
                      <input
                        id="insurance-provider"
                        type="text"
                        className="premium-input"
                        placeholder="Self-Pay"
                        value={insuranceProvider}
                        onChange={(e) => setInsuranceProvider(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="premium-label" htmlFor="policy-number">{t.insurance.policy}</label>
                      <input
                        id="policy-number"
                        type="text"
                        className="premium-input"
                        placeholder="ID"
                        value={insurancePolicyNumber}
                        onChange={(e) => setInsurancePolicyNumber(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><Stethoscope size={20} /></div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t.visitDetails.title}</h2>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="premium-label" htmlFor="reason-for-visit">{t.visitDetails.reason}</label>
                      <select
                        id="reason-for-visit"
                        aria-required="true"
                        className="premium-input"
                        value={reasonForVisit}
                        onChange={(e) => setReasonForVisit(e.target.value)}
                      >
                        <option value="">{t.visitDetails.reasonPlaceholder}</option>
                        {VISIT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="premium-label" htmlFor="medications">{t.visitDetails.meds}</label>
                      <textarea
                        id="medications"
                        className="premium-input min-h-[120px] py-4"
                        placeholder={t.visitDetails.medsPlaceholder}
                        value={currentMedications}
                        onChange={(e) => setCurrentMedications(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="premium-label" htmlFor="allergies">{t.visitDetails.allergies}</label>
                      <textarea
                        id="allergies"
                        className="premium-input min-h-[120px] py-4"
                        placeholder={t.visitDetails.allergiesPlaceholder}
                        value={allergies}
                        onChange={(e) => setAllergies(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 rounded-lg bg-orange-50 text-orange-600"><PhoneCall size={20} /></div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t.emergency.title}</h2>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="premium-label" htmlFor="emergency-name">{t.emergency.name}</label>
                      <input
                        id="emergency-name"
                        type="text"
                        className="premium-input"
                        placeholder={t.emergency.namePlaceholder}
                        value={emergencyContactName}
                        onChange={(e) => setEmergencyContactName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="premium-label" htmlFor="emergency-phone">{t.emergency.phone}</label>
                      <input
                        id="emergency-phone"
                        type="tel"
                        className="premium-input"
                        placeholder="(555) 987-6543"
                        value={emergencyContactPhone}
                        onChange={(e) => setEmergencyContactPhone(formatPhone(e.target.value))}
                      />
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-12 gap-4">
            {step > 1 ? (
              <button onClick={handleBack} className="flex items-center gap-2 px-6 py-4 rounded-2xl font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all">
                <ArrowLeft size={20} /> {t.buttons.back}
              </button>
            ) : <div />}
            <div className="flex gap-4">
              {step < 4 ? (
                <Button variant="primary" onClick={handleNext}>
                  {t.buttons.continue} <ArrowRight size={22} className="ml-2" />
                </Button>
              ) : (
                <Button variant="secondary" onClick={handleSubmit}>
                  {t.buttons.complete} <CheckCircle2 size={22} className="ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
