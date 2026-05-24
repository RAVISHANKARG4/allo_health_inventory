import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ui/toast-provider';
import { Package2 } from 'lucide-react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Allo Inventory Reservation System',
  description: 'Production-ready concurrent multi-warehouse inventory reservation checkout flow.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-indigo-500 selection:text-white">
        <div className="flex flex-col min-h-screen">
          {/* Header */}
          <header className="sticky top-0 z-40 w-full border-b border-slate-800/50 bg-slate-950/70 backdrop-blur-md">
            <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4 sm:px-6">
              <a href="/" className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors">
                <Package2 className="h-6 w-6" />
                <span className="font-bold text-lg text-slate-100 tracking-tight">Allo Checkout Logistics</span>
              </a>
              <nav className="flex items-center gap-4 text-sm font-medium text-slate-400">
                <a href="/" className="hover:text-slate-100 transition-colors">
                  Products Catalog
                </a>
                <span className="text-slate-700">|</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
                  Production Mode
                </span>
              </nav>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 container mx-auto max-w-7xl px-4 sm:px-6 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-900 bg-slate-950/40 py-6 text-center text-xs text-slate-500">
            <p>© 2026 Allo Logistics Take-Home. Built for high-concurrency transaction correctness.</p>
          </footer>
        </div>
        <ToastProvider />
      </body>
    </html>
  );
}
