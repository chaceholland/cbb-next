import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider, DataFreshnessFooter } from '@/components/shared';
import { CommandProvider } from '@/components/command/CommandProvider';

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CBB Pitcher Tracker',
  description: 'Track college baseball pitchers across Division I conferences.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable}`}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-slate-900 text-slate-100 font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <CommandProvider>
            {children}
            <footer className="flex flex-col items-center gap-2 py-4">
              <a
                href="/hub"
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                ★ My Sports hub
              </a>
              <DataFreshnessFooter />
            </footer>
          </CommandProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
