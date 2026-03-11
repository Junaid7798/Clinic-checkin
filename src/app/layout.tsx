import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CheckInProvider } from '@/contexts/CheckInContext';
import KioskWrapper from '@/components/KioskWrapper';

import { Outfit } from 'next/font/google';

const outfit = Outfit({ 
  subsets: ['latin'], 
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap' 
});

export const metadata: Metadata = {
  title: 'Clinic - Check In',
  description: 'Patient self check-in kiosk for Clinic',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${outfit.className} antialiased text-slate-900`}>
        <CheckInProvider>
          <KioskWrapper>
            {children}
          </KioskWrapper>
        </CheckInProvider>
      </body>
    </html>
  );
}
