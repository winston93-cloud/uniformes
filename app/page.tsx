import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}

// Forzar que sea dinámico en vez de estático
export const dynamic = 'force-dynamic';
