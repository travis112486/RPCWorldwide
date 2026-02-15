import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'RPC Worldwide | Casting Network',
  description: 'Connecting talent with casting directors worldwide. Browse casting calls, create your profile, and land your next role.',
  metadataBase: new URL('https://rpcworldwide.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'RPC Worldwide | Casting Network',
    description: 'Connecting talent with casting directors worldwide. Browse casting calls, create your profile, and land your next role.',
    url: 'https://rpcworldwide.com',
    siteName: 'RPC Worldwide',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RPC Worldwide | Casting Network',
    description: 'Connecting talent with casting directors worldwide.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
