import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'sonner';

/* ── v2.0 Typography — loaded via next/font for zero layout shift ────────
   Both fonts are configured in CSS variable mode so they override the
   fallback stacks defined in app/tokens.css:
     --font-sans  →  Inter (loaded)
     --font-mono  →  JetBrains Mono (loaded)                              */
const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-sans',
  display:  'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets:  ['latin'],
  variable: '--font-mono',
  display:  'swap',
});

export const metadata: Metadata = {
  title: 'Fortune Procurement System',
  description: 'Fortune Procurement Automation System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* Apply both font CSS variables to <html> so they cascade everywhere */
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </body>
    </html>
  );
}

