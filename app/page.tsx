"use client";

import Link from "next/link";
import { ClipboardList, ListChecks, UserMinus, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { LoadingCard } from "@/components/loading-card";
import { MatchSummary } from "@/components/match-summary";
import { ErrorCard } from "@/components/error-card";
import { PublicList } from "@/components/public-list";
import type { AppData, Match, RegistrationWithPlayer } from "@/lib/types";
import { getCurrentMatch, getData, getPublicLists } from "@/lib/store";

export default function HomePage() {
  const [match, setMatch] = useState<Match | null>(null);
  const [counts, setCounts] = useState({ confirmed: 0, waitlist: 0, available: 0 });
  const [confirmed, setConfirmed] = useState<RegistrationWithPlayer[]>([]);
  const [waitlist, setWaitlist] = useState<RegistrationWithPlayer[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getData()
      .then((data: AppData) => {
        const current = getCurrentMatch(data);
        setMatch(current);
        if (current) {
          const lists = getPublicLists(data, current);
          setConfirmed(lists.confirmed);
          setWaitlist(lists.waitlist);
          setCounts({
            confirmed: lists.confirmed.length,
            waitlist: lists.waitlist.length,
            available: lists.available
          });
        }
      })
      .catch((currentError) => setError(currentError instanceof Error ? currentError.message : "No se pudo cargar la app."));
  }, []);

  if (error) {
    return <ErrorCard message={error} />;
  }

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
        <Action href="/anotarme" icon={<UserPlus size={22} />} title="Anotarme al partido" />
        <Action href="/cancelar" icon={<UserMinus size={22} />} title="Cancelar mi asistencia" />
        <Action href="/lista" icon={<ListChecks size={22} />} title="Ver lista completa" secondary />
        <Action href="/admin" icon={<ClipboardList size={22} />} title="Panel administrador" secondary />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <PublicList title="Confirmados" registrations={confirmed} empty="Todavía no hay confirmados." status="confirmed" />
        <PublicList
          title="Lista de espera"
          registrations={waitlist}
          empty="No hay jugadores en espera."
          status="waitlist"
          startAt={confirmed.length + 1}
        />
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
