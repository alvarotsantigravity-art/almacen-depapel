import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Almacén de Papel — Gestión de Albaranes y Bobinas",
  description: "Sistema técnico de control de inventario de bobinas de papel, albaranes y rotativas offset",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#ffffff] text-[#1e1e1e] font-sans selection:bg-[#0098f2]/15 selection:text-[#0098f2]">
        {children}
      </body>
    </html>
  );
}
