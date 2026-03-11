'use client';

import React from 'react';

interface LoadingSpinnerProps {
    text?: string;
    fullPage?: boolean;
}

export default function LoadingSpinner({ text = 'Processing...', fullPage = false }: LoadingSpinnerProps) {
    const spinner = (
        <div className="flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-[#1A5276] rounded-full animate-spin" />
            {text && <p className="text-lg text-gray-600 font-medium">{text}</p>}
        </div>
    );

    if (fullPage) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                {spinner}
            </div>
        );
    }

    return <div className="flex items-center justify-center py-12">{spinner}</div>;
}
