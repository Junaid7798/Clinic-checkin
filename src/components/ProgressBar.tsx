'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { User, ShieldCheck, Stethoscope, PhoneCall, Check } from 'lucide-react';

import { useCheckIn } from '@/contexts/CheckInContext';
import { translations } from '@/lib/translations';

interface ProgressBarProps {
    currentStep: number;
    totalSteps?: number;
}

export default function ProgressBar({ currentStep, totalSteps = 4 }: ProgressBarProps) {
    const { language } = useCheckIn();
    const t = translations[language];

    const steps = [
        { label: t.steps.info, icon: User, color: 'indigo' },
        { label: t.steps.insurance, icon: ShieldCheck, color: 'emerald' },
        { label: t.steps.details, icon: Stethoscope, color: 'blue' },
        { label: t.steps.phone, icon: PhoneCall, color: 'orange' },
    ];

    return (
        <div className="mb-12 relative">
            <div className="flex justify-between items-center max-w-lg mx-auto relative px-2">
                {/* Connection Line */}
                <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-200 -z-10" />
                <motion.div 
                    initial={{ width: '0%' }}
                    animate={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
                    className="absolute top-5 left-8 h-0.5 bg-indigo-500 transition-all duration-500 -z-10 shadow-[0_0_8px_rgba(99,102,241,0.5)]" 
                />

                {steps.map((s, i) => {
                    const stepNum = i + 1;
                    const isActive = stepNum === currentStep;
                    const isComplete = stepNum < currentStep;
                    const Icon = s.icon;

                    return (
                        <div key={i} className="flex flex-col items-center gap-2 group">
                            <motion.div
                                initial={false}
                                animate={{
                                    backgroundColor: isComplete ? '#059669' : isActive ? '#4f46e5' : '#ffffff',
                                    borderColor: isComplete ? '#059669' : isActive ? '#4f46e5' : '#e2e8f0',
                                    scale: isActive ? 1.15 : 1,
                                }}
                                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-shadow duration-300 ${
                                    isActive ? 'shadow-lg shadow-indigo-500/20' : ''
                                }`}
                            >
                                {isComplete ? (
                                    <Check className="text-white" size={18} strokeWidth={3} />
                                ) : (
                                    <Icon className={isActive ? 'text-white' : 'text-slate-400'} size={18} />
                                )}
                            </motion.div>
                            <span className={`text-[11px] font-bold uppercase tracking-wider transition-colors mt-2 ${
                                isActive ? 'text-white' : 'text-slate-400'
                            }`}>
                                {s.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
