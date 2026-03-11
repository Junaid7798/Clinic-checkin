import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle';

interface VariantOptions {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  className?: string;
}

function buttonClasses({ variant = 'primary', fullWidth, className = '' }: VariantOptions) {
  const base =
    'inline-flex items-center justify-center rounded-2xl font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500';

  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-600/10 px-8 py-4 text-lg',
    secondary:
      'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xl shadow-emerald-600/10 px-8 py-4 text-lg',
    ghost:
      'border-2 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 px-6 py-3 text-sm',
    subtle:
      'text-slate-400 hover:text-slate-600 px-4 py-2 text-xs uppercase tracking-widest',
  };

  const width = fullWidth ? 'w-full' : '';

  return [base, variants[variant], width, className].filter(Boolean).join(' ');
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({ variant = 'primary', fullWidth, className, ...props }: ButtonProps) {
  return (
    <button
      className={buttonClasses({ variant, fullWidth, className })}
      {...props}
    />
  );
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Card({ header, footer, children, className = '', ...rest }: CardProps) {
  return (
    <section
      className={`glass-card relative overflow-hidden backdrop-blur-2xl ${className}`}
      {...rest}
    >
      {header && <header className="mb-6">{header}</header>}
      {children}
      {footer && <footer className="mt-8">{footer}</footer>}
    </section>
  );
}
