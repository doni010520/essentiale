import type { Metadata } from "next";
import "./globals.css";

// Fonte da interface: stack do sistema (definida em globals.css via --font-sans).
// Sem next/font/google para que o build não dependa de rede (Google Fonts) — essencial
// para builds em VPS/EasyPanel sem acesso garantido à internet de build.

export const metadata: Metadata = {
  title: "MVF Chat — Multiatendimento WhatsApp",
  description: "Sistema de multiatendimento e automações via WhatsApp.",
  manifest: "/manifest.json",
  themeColor: "#00a8ff",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MVF Chat" },
  viewport: { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
