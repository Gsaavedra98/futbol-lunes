import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "Fútbol Lunes",
  description: "PWA para organizar el partido de fútbol de los lunes.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Fútbol Lunes",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#155b37",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <PwaRegister />
        <header className="sticky top-0 z-20 border-b border-ink/10 bg-white/90 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-black text-ink">
              <span className="grid size-9 place-items-center rounded-lg bg-pitch text-white">
                <Trophy size={20} />
              </span>
              Fútbol Lunes
            </Link>
            <div className="flex items-center gap-2 text-sm font-bold text-ink/70">
              <Link className="rounded-lg px-3 py-2 hover:bg-ink/5" href="/lista">
                Lista
              </Link>
              <Link className="rounded-lg px-3 py-2 hover:bg-ink/5" href="/admin">
                Admin
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto min-h-[calc(100vh-64px)] max-w-5xl px-4 py-5 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
