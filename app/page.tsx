"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Copy,
  MapPin,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users
} from "lucide-react";
import { useEffect, useState } from "react";
import { LoadingCard } from "@/components/loading-card";
import { ErrorCard } from "@/components/error-card";
import { PublicList } from "@/components/public-list";
import type { AppData, Match, RegistrationWithPlayer } from "@/lib/types";
import { getCurrentMatch, getData, getPublicLists } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusPill } from "@/components/status-pill";

export default function HomePage() {
  const [match, setMatch] = useState<Match | null>(null);
  const [counts, setCounts] = useState({ confirmed: 0, waitlist: 0, available: 0 });
  const [confirmed, setConfirmed] = useState<RegistrationWithPlayer[]>([]);
  const [waitlist, setWaitlist] = useState<RegistrationWithPlayer[]>([]);
  const [copiedPaymentKey, setCopiedPaymentKey] = useState(false);
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
    <div className="grid gap-4 sm:gap-5">
      <section className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.08em] text-pitch">Partido de la semana</p>
            <h1 className="mt-1 text-3xl font-black leading-tight text-ink">Fútbol Lunes</h1>
          </div>
          <StatusPill status={match.status} />
        </div>

        <div className="mt-4 grid gap-2">
          <MatchFact icon={<CalendarDays size={18} />} primary={formatDate(match.date)} secondary={match.time} />
          <MatchFact icon={<MapPin size={18} />} primary={match.location} secondary="Cancha" />
          <MatchFact icon={<Banknote size={18} />} primary={formatCurrency(match.price_per_player)} secondary="Por jugador" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <CupMetric icon={<Users size={17} />} label="Convocados" value={`${counts.confirmed}/${match.active_capacity}`} />
          <CupMetric label="Disponibles" value={counts.available} />
          <CupMetric label="Suplentes" value={counts.waitlist} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Action href="/anotarme" icon={<UserPlus size={22} />} title="Anotarme" />
        <Action href="/cancelar" icon={<UserMinus size={22} />} title="Cancelar" secondary />
        <Action href="/admin" icon={<ShieldCheck size={22} />} title="Admin" secondary />
      </section>

      <section className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.08em] text-pitch">Pago del partido</p>
            <h2 className="mt-1 text-xl font-black text-ink">{formatCurrency(match.price_per_player)}</h2>
          </div>
          <Banknote className="text-pitch" size={24} />
        </div>
        <div className="mt-4 grid gap-2 text-sm font-semibold text-ink/70">
          <p>Responsable: <span className="font-black text-ink">{match.payment_responsible_name || "Por definir"}</span></p>
          <p>{match.payment_key_type || "Llave"}: <span className="font-black text-ink">{match.payment_key || "Por definir"}</span></p>
          {match.payment_deadline ? <p>Fecha límite: <span className="font-black text-ink">{match.payment_deadline}</span></p> : null}
          {match.payment_note ? <p className="rounded-lg bg-line/70 p-3">{match.payment_note}</p> : null}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            className="secondary-button"
            disabled={!match.payment_key}
            onClick={async () => {
              if (!match.payment_key) return;
              await navigator.clipboard.writeText(match.payment_key);
              setCopiedPaymentKey(true);
              window.setTimeout(() => setCopiedPaymentKey(false), 1400);
            }}
          >
            <Copy size={18} />
            {copiedPaymentKey ? "Llave copiada" : "Copiar llave"}
          </button>
          <Action href="/pago" icon={<CheckCircle2 size={20} />} title="Reportar pago" />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <PublicList
          title="Convocados"
          registrations={confirmed}
          empty="Todavía no hay convocados."
          status="confirmed"
          counter={`${confirmed.length}/${match.active_capacity}`}
        />
        <PublicList
          title="Suplentes"
          registrations={waitlist}
          empty="No hay suplentes."
          status="waitlist"
          startAt={confirmed.length + 1}
          counter={`${waitlist.length} en espera`}
          badgeLabel="Suplente"
          rowBadgeLabel="Suplente"
        />
      </section>

      <section className="flex gap-3 rounded-lg border border-sun/30 bg-sun/15 p-4 text-ink">
        <AlertTriangle className="mt-0.5 shrink-0 text-clay" size={20} />
        <p className="text-sm font-semibold leading-relaxed">
          Regla del grupo: los primeros {match.active_capacity} quedan convocados. Si alguien confirmado cancela el mismo lunes sin reemplazo,
          debe pagar su cupo.
        </p>
      </section>
    </div>
  );
}

function MatchFact({ icon, primary, secondary }: { icon: React.ReactNode; primary: string; secondary: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-line/70 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-pitch">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-ink">{primary}</span>
        <span className="block text-xs font-bold text-ink/55">{secondary}</span>
      </span>
    </div>
  );
}

function CupMetric({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="min-h-20 rounded-lg bg-pitch p-3 text-white">
      {icon ? <div className="flex items-center gap-1 text-white/70">{icon}</div> : null}
      <span className={icon ? "mt-1 block text-2xl font-black leading-none" : "block text-2xl font-black leading-none"}>{value}</span>
      <span className="mt-1 block text-xs font-bold text-white/75">{label}</span>
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
