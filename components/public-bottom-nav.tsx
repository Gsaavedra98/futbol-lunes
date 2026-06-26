"use client";

import Link from "next/link";
import { Home, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/anotarme", label: "Anotarme", icon: UserPlus },
  { href: "/cancelar", label: "Cancelar", icon: UserMinus },
  { href: "/admin", label: "Admin", icon: ShieldCheck }
];

export function PublicBottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-white/95 px-3 py-2 shadow-soft backdrop-blur sm:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-xs font-black active:bg-line",
                active ? "bg-line text-pitch" : "text-ink/75"
              )}
            >
              <Icon size={19} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
