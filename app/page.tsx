"use client";

import Link from "next/link";
import { ClipboardList, ListChecks, UserMinus, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { LoadingCard } from "@/components/loading-card";
import { MatchSummary } from "@/components/match-summary";
import type { AppData, Match } from "@/lib/types";
import { getCurrentMatch, getData, getPublicLists } from "@/lib/store";

export default function HomePage() {
  const [match, setMatch] = useState<Match | null>(null);
  const [counts, setCounts] = useState({ confirmed: 0, waitlist: 0, available: 0 });

  useEffect(() => {
    getData().then((data: AppData) => {
      const current = getCurrentMatch(data);
      setMatch(current);
      if (current) {
        const lists = getPublicLists(data, current);
        setCounts({
          confirmed: lists.confirmed.length,
          waitlist: lists.waitlist.length,
          available: lists.available
        });
      }
    });
  }, []);

  if (!match) {
    return <LoadingCard />;
  }

  return (
    <div className="grid gap-5">
      <MatchSummary match={match} />

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Confirmados" value={counts.confirmed} />
        <Metric label="En espera" value={counts.waitlist} />
        <Metric label="Disponibles" value={counts.available} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Action href="/anotarme" icon={<UserPlus size={22} />} title="Anotarme" />
        <Action href="/cancelar" icon={<UserMinus size={22} />} title="Cancelar asistencia" />
        <Action href="/lista" icon={<ListChecks size={22} />} title="Ver lista" />
        <Action href="/admin" icon={<ClipboardList size={22} />} title="Panel administrador" secondary />
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-pitch p-4 text-white">
      <span className="block text-3xl font-black">{value}</span>
      <span className="block text-sm font-bold text-white/75">{label}</span>
    </div>
  );
}

function Action({
  href,
  icon,
  title,
  secondary
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  secondary?: boolean;
}) {
  return (
    <Link href={href} className={secondary ? "secondary-button justify-start" : "primary-button justify-start"}>
      {icon}
      {title}
    </Link>
  );
}
