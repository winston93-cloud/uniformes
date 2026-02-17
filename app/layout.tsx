import type { Metadata } from "next";
import "./globals.css";
import ThemeToggler from "@/components/ThemeToggler";
import BackgroundGradient from "@/components/BackgroundGradient";
import MobileScrollFix from "@/components/MobileScrollFix";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "Sistema de Gestión de Uniformes",
  description: "Sistema de gestión de uniformes escolares",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" style={{ height: '100%', overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <body style={{ height: '100%', overflow: 'auto', WebkitOverflowScrolling: 'touch', position: 'relative' }}>
        <AuthProvider>
          <MobileScrollFix />
          <BackgroundGradient />
          <ThemeToggler />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
