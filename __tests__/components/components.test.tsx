import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBanner from '@/components/ErrorBanner';
import ProgressBar from '@/components/ProgressBar';

// ─── Mock next/navigation ─────────────────────
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
    usePathname: () => '/',
}));

// ─── LoadingSpinner ───────────────────────────
describe('LoadingSpinner', () => {
    it('renders with default text', () => {
        render(<LoadingSpinner />);
        expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('renders with custom text', () => {
        render(<LoadingSpinner text="Loading data..." />);
        expect(screen.getByText('Loading data...')).toBeInTheDocument();
    });

    it('renders full page variant', () => {
        const { container } = render(<LoadingSpinner fullPage />);
        const overlay = container.firstChild as HTMLElement;
        expect(overlay.className).toContain('fixed');
        expect(overlay.className).toContain('inset-0');
    });
});

// ─── ErrorBanner ──────────────────────────────
describe('ErrorBanner', () => {
    it('renders error message', () => {
        render(<ErrorBanner message="Something went wrong" />);
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText('Please see the front desk for assistance.')).toBeInTheDocument();
    });

    it('shows Start Over button by default', () => {
        render(<ErrorBanner message="Error" />);
        expect(screen.getByText('Start Over')).toBeInTheDocument();
    });

    it('hides Start Over when showStartOver is false', () => {
        render(<ErrorBanner message="Error" showStartOver={false} />);
        expect(screen.queryByText('Start Over')).not.toBeInTheDocument();
    });

    it('shows Try Again when onRetry provided', () => {
        render(<ErrorBanner message="Error" onRetry={() => { }} />);
        expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
});

// ─── ProgressBar ──────────────────────────────
describe('ProgressBar', () => {
    it('renders step text', () => {
        render(<ProgressBar currentStep={1} />);
        expect(screen.getByText('Info')).toBeInTheDocument();
    });

    it('renders all step labels', () => {
        render(<ProgressBar currentStep={2} />);
        expect(screen.getByText('Info')).toBeInTheDocument();
        expect(screen.getByText('Insurance')).toBeInTheDocument();
        expect(screen.getByText('Details')).toBeInTheDocument();
        expect(screen.getByText('Phone')).toBeInTheDocument();
    });

    it('shows correct step count', () => {
        render(<ProgressBar currentStep={3} />);
        // The third label should be active (Details)
        expect(screen.getByText('Details')).toBeInTheDocument();
    });
});
