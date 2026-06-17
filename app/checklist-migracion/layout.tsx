import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-checklist-sans',
});

export const metadata: Metadata = {
  title: 'Checklist migración Plan B | Uniformes',
  description:
    'Lista de verificación: cuentas Supabase/Vercel/InsForge, dos sistemas, alumnos en Supabase y conmutador.',
};

export default function ChecklistMigracionLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${plusJakarta.variable} ${plusJakarta.className}`}>{children}</div>;
}
