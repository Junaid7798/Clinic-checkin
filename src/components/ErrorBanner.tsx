'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface ErrorBannerProps {
    message: string;
    onRetry?: () => void;
    showStartOver?: boolean;
}

export default function ErrorBanner({ message, onRetry, showStartOver = true }: ErrorBannerProps) {
    const router = useRouter();

    return (
        <div className="bg-red-50 border-l-4 border-[#E74C3C] p-6 rounded-lg mb-6" role="alert">
            <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-[#E74C3C] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div className="flex-1">
                    <p className="text-[#E74C3C] font-semibold text-lg">{message}</p>
                    <p className="text-red-600 mt-1">Please see the front desk for assistance.</p>

                    <div className="flex gap-4 mt-4">
                        {onRetry && (
                            <button
                                onClick={onRetry}
                                className="px-6 py-3 bg-[#E74C3C] text-white rounded-lg font-medium text-base hover:bg-red-600 active:bg-red-700 transition-colors min-h-[48px]"
                            >
                                Try Again
                            </button>
                        )}
                        {showStartOver && (
                            <button
                                onClick={() => router.push('/')}
                                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium text-base hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[48px]"
                            >
                                Start Over
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
