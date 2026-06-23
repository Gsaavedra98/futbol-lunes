import { CalendarDays, MapPin, Users, Wallet } from "lucide-react";
import type { Match } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusPill } from "./status-pill";

export function MatchSummary({ match }: { match: Match }) {
  return (
    <section className="card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.08em] text-pitch">Próximo partido</p>
          <h1 className="mt-1 text-3xl font-black leading-tight text-ink sm:text-4xl">Fútbol Lunes</h1>
        </div>
        <StatusPill status={match.status} />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Info icon={<CalendarDays size={18} />} label={formatDate(match.date)} value={match.time} />
        <Info icon={<MapPin size={18} />} label={match.location} value="Cancha confirmada" />
        <Info icon={<Wallet size={18} />} label={formatCurrency(match.price_per_player)} value="Por jugador" />
        <Info icon={<Users size={18} />} label={`${match.active_capacity} cupos`} value="Cupo activo" />
      </div>
    </section>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-h-20 items-center gap-3 rounded-lg bg-line/70 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-pitch">{icon}</span>
      <span>
        <span className="block text-base font-black text-ink">{label}</span>
        <span className="block text-sm font-semibold text-ink/60">{value}</span>
      </span>
    </div>
  );
}
