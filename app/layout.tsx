import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { PublicBottomNav } from "@/components/public-bottom-nav";

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
        <header className="sticky top-0 z-20 w-full border-b border-ink/10 bg-white/90 backdrop-blur">
          <nav className="mx-auto flex w-full max-w-5xl items-center gap-2 px-3 py-3 sm:px-4">
            <Link href="/" className="flex min-w-0 items-center gap-2 font-black text-ink">
              <span className="grid size-9 place-items-center rounded-lg bg-pitch text-white">
                <Trophy size={20} />
              </span>
              <span className="truncate">Fútbol Lunes</span>
            </Link>
          </nav>
        </header>
        <main className="mx-auto w-full min-w-0 max-w-5xl px-3 py-4 pb-24 sm:px-4 sm:py-8">{children}</main>
        <PublicBottomNav />
      </body>
    </html>
  );
}
