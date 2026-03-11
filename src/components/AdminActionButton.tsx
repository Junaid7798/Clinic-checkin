'use client';

import React, { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AdminActionButtonProps {
    action: string;
    fields: Record<string, string>;
    children: React.ReactNode;
    confirmMessage?: string;
    className?: string;
    title?: string;
}

export default function AdminActionButton({ 
    action, 
    fields, 
    children, 
    confirmMessage,
    className,
    title
}: AdminActionButtonProps) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const router = useRouter();

    const handleClick = async (e: React.MouseEvent) => {
        if (confirmMessage && !confirm(confirmMessage)) {
            return;
        }
        
        setLoading(true);
        setStatus('idle');

        try {
            const formData = new FormData();
            Object.entries(fields).forEach(([name, value]) => {
                formData.append(name, value);
            });

            const res = await fetch(action, {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                setStatus('success');
                // Refresh the page data
                router.refresh();
                // If it was a redirect, we might need to handle it, 
                // but router.refresh() should suffice if the server route returns a redirect.
                // However, fetch doesn't automatically follow redirect and update the browser URL 
                // for the whole page. So we check if we were redirected.
                if (res.redirected) {
                    window.location.href = res.url;
                }
            } else {
                const text = await res.text();
                console.error(`Action failed: ${text}`);
                setStatus('error');
                alert(`Error: ${text || 'Action failed'}`);
            }
        } catch (err) {
            console.error('Action failed:', err);
            setStatus('error');
            alert('Something went wrong. Please check your connection.');
        } finally {
            setLoading(false);
            // Reset status after a delay
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            title={title}
            className={`${className} flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed relative group`}
        >
            {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : status === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : status === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-500" />
            ) : (
                children
            )}
        </button>
    );
}
