import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Checklist migración Plan B | Uniformes',
  description:
    'Lista de verificación: cuentas Supabase/Vercel/InsForge, dos sistemas, alumnos en Supabase, bitácora y conmutador.',
};

export default function ChecklistMigracionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
