import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AccelerateIQ — Financial Health Analysis',
  description: 'AI-powered financial analysis for entrepreneurial accelerators',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
