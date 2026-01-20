import type { Metadata } from "next";
import "./globals.css";
import ThemeToggler from "@/components/ThemeToggler";

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
    <html lang="es">
      <body>
        <ThemeToggler />
        {children}
      </body>
    </html>
  );
}
