"use client";

import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clipboard,
  Lock,
  RefreshCcw,
  Save,
  ShieldCheck,
  UserMinus,
  XCircle
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { LoadingCard } from "@/components/loading-card";
import { StatusPill } from "@/components/status-pill";
import { ErrorCard } from "@/components/error-card";
import {
  getCurrentMatch,
  getAdminData,
  updateCancellationDecision,
  updateMatch,
  updatePayment,
  updateRegistrationStatus,
  upsertAttendance
} from "@/lib/store";
import type {
  AdminDecision,
  AppData,
  CancellationWithPlayer,
  Match,
  MatchStatus,
  PaymentStatus,
  RegistrationStatus,
  RegistrationWithPlayer
} from "@/lib/types";
import { formatCurrency, formatDate, generateWhatsAppSummary, isSameMonday, registrationsForMatch } from "@/lib/utils";

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [data, setData] = useState<AppData | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [includeDebts, setIncludeDebts] = useState(true);
  const [dataError, setDataError] = useState("");

  async function refresh() {
    try {
      setDataError("");
      const nextData = await getAdminData();
      const current = getCurrentMatch(nextData);
      setData(nextData);
      setMatch(current);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "No se pudieron cargar los datos.");
    }
  }

  useEffect(() => {
    getAdminData()
      .then((nextData) => {
        const current = getCurrentMatch(nextData);
        setData(nextData);
        setMatch(current);
        setAuthorized(true);
      })
      .catch(() => setAuthorized(false))
      .finally(() => setCheckingSession(false));
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    if (!response.ok) {
      setLoginError("Clave incorrecta.");
      return;
    }

    setAuthorized(true);
    refresh();
  }

  if (checkingSession) {
    return <LoadingCard />;
  }

  if (!authorized) {
    return (
      <div className="mx-auto max-w-md">
        <section className="card">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-lg bg-pitch text-white">
              <Lock size={22} />
            </span>
            <h1 className="text-2xl font-black text-ink">Admin</h1>
          </div>
          <form className="mt-5 grid gap-4" onSubmit={login}>
            <label className="grid gap-2">
              <span className="label">Clave de administrador</span>
              <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {loginError ? <p className="rounded-lg bg-clay/10 p-3 text-sm font-bold text-clay">{loginError}</p> : null}
            <button className="primary-button">Entrar</button>
          </form>
        </section>
      </div>
    );
  }

  if (!data || !match) {
    return dataError ? <ErrorCard message={dataError} /> : <LoadingCard />;
  }

  const registrations = registrationsForMatch(data, match.id);
  const cancellations = data.cancellations
    .filter((cancellation) => cancellation.match_id === match.id)
    .map((cancellation) => ({
      ...cancellation,
      player: data.players.find((player) => player.id === cancellation.player_id)!,
      promoted_player: cancellation.promoted_player_id
        ? data.players.find((player) => player.id === cancellation.promoted_player_id) ?? null
        : null
    }))
    .filter((cancellation) => Boolean(cancellation.player));
  const summary = generateWhatsAppSummary(match, registrations, includeDebts, data.payments, data.players, cancellations);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.08em] text-pitch">Panel administrador</p>
          <h1 className="text-3xl font-black text-ink">Control del partido</h1>
        </div>
        <button className="secondary-button" onClick={refresh}>
          <RefreshCcw size={18} />
          Actualizar
        </button>
      </div>

      <MatchEditor match={match} onSaved={refresh} />
      <AdminSummary data={data} match={match} registrations={registrations} cancellations={cancellations} />
      <PlayerManagement data={data} match={match} registrations={registrations} onChanged={refresh} />
      <CancellationsAdmin match={match} cancellations={cancellations} onChanged={refresh} />
      <WhatsAppBox summary={summary} includeDebts={includeDebts} setIncludeDebts={setIncludeDebts} />
    </div>
  );
}

function AdminSummary({
  data,
  match,
  registrations,
  cancellations
}: {
  data: AppData;
  match: Match;
  registrations: RegistrationWithPlayer[];
  cancellations: CancellationWithPlayer[];
}) {
  const confirmed = registrations.filter((registration) => registration.status === "confirmed").length;
  const waitlist = registrations.filter((registration) => registration.status === "waitlist").length;
  const paid = data.payments.filter((payment) => payment.match_id === match.id && payment.status === "paid").length;
  const debts = data.payments.filter((payment) => payment.match_id === match.id && payment.status === "debt").length;
  const pendingPayments = registrations.filter((registration) => {
    const payment = data.payments.find((item) => item.match_id === match.id && item.player_id === registration.player_id);
    return registration.status !== "cancelled" && (!payment || payment.status === "pending" || payment.status === "pending_review");
  }).length;
  const mondayCancellations = cancellations.filter((cancellation) => isSameMonday(match.date, cancellation.created_at)).length;

  return (
    <section className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <SummaryTile label="Confirmados" value={`${confirmed}/${match.active_capacity}`} />
      <SummaryTile label="Suplentes" value={waitlist} />
      <SummaryTile label="Pagados" value={paid} />
      <SummaryTile label="Pendientes" value={pendingPayments} />
      <SummaryTile label="Deudas" value={debts} tone="danger" />
      <SummaryTile label="Cancel. lunes" value={mondayCancellations} />
    </section>
  );
}

function SummaryTile({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "danger" }) {
  return (
    <div className={tone === "danger" ? "rounded-lg bg-clay/15 p-3 text-clay" : "rounded-lg bg-pitch p-3 text-white"}>
      <span className="block text-2xl font-black leading-none">{value}</span>
      <span className={tone === "danger" ? "mt-1 block text-xs font-bold text-clay/80" : "mt-1 block text-xs font-bold text-white/75"}>{label}</span>
    </div>
  );
}

type PlayerFilter = "all" | "confirmed" | "waitlist" | "cancelled" | "payment_pending" | "debt";

const playerFilters: Array<{ id: PlayerFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "confirmed", label: "Confirmados" },
  { id: "waitlist", label: "Suplentes" },
  { id: "cancelled", label: "Cancelados" },
  { id: "payment_pending", label: "Pend. pago" },
  { id: "debt", label: "Deudores" }
];

function PlayerManagement({
  data,
  match,
  registrations,
  onChanged
}: {
  data: AppData;
  match: Match;
  registrations: RegistrationWithPlayer[];
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<PlayerFilter>("all");
  const [busyAction, setBusyAction] = useState<string>("");
  const [feedback, setFeedback] = useState("");

  const filtered = useMemo(
    () =>
      registrations.filter((registration) => {
        const payment = data.payments.find((item) => item.match_id === match.id && item.player_id === registration.player_id);
        if (filter === "all") return true;
        if (filter === "payment_pending") return registration.status !== "cancelled" && (!payment || payment.status === "pending" || payment.status === "pending_review");
        if (filter === "debt") return payment?.status === "debt";
        return registration.status === filter;
      }),
    [data.payments, filter, match.id, registrations]
  );

  async function runAction(key: string, message: string, action: () => Promise<void>) {
    setBusyAction(key);
    setFeedback("");
    try {
      await action();
      setFeedback(message);
      await onChanged();
      window.setTimeout(() => setFeedback(""), 1800);
    } finally {
      setBusyAction("");
    }
  }

  return (
    <section className="card">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-black text-ink">Gestión de jugadores</h2>
        <p className="text-sm font-semibold text-ink/60">
          {formatDate(match.date)}
          <span className="mx-1">·</span>
          {match.time}
          <span className="mx-1">·</span>
          {match.location}
        </p>
      </div>

      <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {playerFilters.map((item) => (
          <button
            key={item.id}
            className={filter === item.id ? "status-pill bg-pitch text-white" : "status-pill bg-line text-ink"}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {feedback ? <p className="mt-3 rounded-lg bg-mint/50 p-3 text-sm font-bold text-pitch">{feedback}</p> : null}

      <div className="mt-4 grid gap-3">
        {filtered.map((registration) => {
          const attendance = data.attendance.find((item) => item.match_id === match.id && item.player_id === registration.player_id);
          const payment = data.payments.find((item) => item.match_id === match.id && item.player_id === registration.player_id);
          const attendanceLabel = attendance ? (attendance.attended ? "Asistió" : "No asistió") : "Pendiente";
          const attendanceTone = attendance ? (attendance.attended ? "bg-mint text-pitch" : "bg-clay/15 text-clay") : "bg-sun/25 text-ink";
          const paymentStatus = payment?.status ?? "pending";

          return (
            <article key={registration.id} className="grid min-w-0 gap-3 rounded-lg border border-ink/10 bg-white p-3">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-ink">{registration.player.name}</p>
                  <p className="text-sm font-bold text-ink/55">
                    #{registration.position} · {registration.status === "confirmed" ? "Confirmado" : registration.status === "waitlist" ? "Suplente" : registration.status === "cancelled" ? "Cancelado" : "Reemplazo"}
                  </p>
                </div>
                <StatusPill status={registration.status === "waitlist" ? "waitlist" : registration.status} />
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`status-pill ${attendanceTone}`}>Asistencia: {attendanceLabel}</span>
                <StatusPill status={paymentStatus} />
                {payment?.reported_amount ? <span className="status-pill bg-line text-ink">Reportó {formatCurrency(payment.reported_amount)}</span> : null}
              </div>

              {payment?.method || payment?.reference ? (
                <div className="rounded-lg bg-line/70 p-3 text-sm font-semibold text-ink/70">
                  {payment.method ? <p>Método: {payment.method}</p> : null}
                  {payment.reference ? <p>Referencia: {payment.reference}</p> : null}
                  {payment.reported_at ? <p>Reporte: {new Date(payment.reported_at).toLocaleString("es-CO")}</p> : null}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <ActionChip
                  icon={<CheckCircle2 size={16} />}
                  label="Asistió"
                  loading={busyAction === `${registration.id}-attended`}
                  onClick={() => runAction(`${registration.id}-attended`, "Asistencia actualizada", () => upsertAttendance(match.id, registration.player_id, true))}
                />
                <ActionChip
                  icon={<XCircle size={16} />}
                  label="No asistió"
                  loading={busyAction === `${registration.id}-missed`}
                  onClick={() => runAction(`${registration.id}-missed`, "Asistencia actualizada", () => upsertAttendance(match.id, registration.player_id, false))}
                />
                <ActionChip
                  icon={<Banknote size={16} />}
                  label="Pagó"
                  loading={busyAction === `${registration.id}-paid`}
                  onClick={() => runAction(`${registration.id}-paid`, "Pago marcado como pagado", () => updatePayment(match.id, registration.player_id, match.price_per_player, "paid"))}
                />
                <ActionChip
                  icon={<AlertTriangle size={16} />}
                  label="Debe"
                  loading={busyAction === `${registration.id}-debt`}
                  onClick={() => runAction(`${registration.id}-debt`, "Jugador marcado como deuda", () => updatePayment(match.id, registration.player_id, match.price_per_player, "debt"))}
                />
                <ActionChip
                  icon={<ShieldCheck size={16} />}
                  label="Exonerar"
                  loading={busyAction === `${registration.id}-waived`}
                  onClick={() => runAction(`${registration.id}-waived`, "Pago exonerado", () => updatePayment(match.id, registration.player_id, match.price_per_player, "waived"))}
                />
                <ActionChip
                  icon={<UserMinus size={16} />}
                  label="Cancelar"
                  loading={busyAction === `${registration.id}-cancelled`}
                  onClick={() => runAction(`${registration.id}-cancelled`, "Inscripción cancelada", () => updateRegistrationStatus(registration.id, "cancelled"))}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="field py-2"
                  value={registration.status}
                  onChange={(event) =>
                    runAction(`${registration.id}-status`, "Estado de lista actualizado", () =>
                      updateRegistrationStatus(registration.id, event.target.value as RegistrationStatus)
                    )
                  }
                >
                  <option value="confirmed">Confirmado</option>
                  <option value="waitlist">Suplente</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="replacement">Reemplazo</option>
                </select>
                <select
                  className="field py-2"
                  value={paymentStatus}
                  onChange={(event) =>
                    runAction(`${registration.id}-payment`, "Estado de pago actualizado", () =>
                      updatePayment(match.id, registration.player_id, match.price_per_player, event.target.value as PaymentStatus)
                    )
                  }
                >
                  <option value="pending">Pendiente</option>
                  <option value="pending_review">Por revisar</option>
                  <option value="paid">Pagado</option>
                  <option value="rejected">Rechazado</option>
                  <option value="debt">Deuda</option>
                  <option value="waived">Exonerado</option>
                </select>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ActionChip({
  icon,
  label,
  loading,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-ink/10 bg-line px-3 py-2 text-sm font-black text-ink transition active:scale-[0.99] disabled:opacity-60"
      disabled={loading}
      onClick={onClick}
    >
      {icon}
      {loading ? "..." : label}
    </button>
  );
}

function MatchEditor({ match, onSaved }: { match: Match; onSaved: () => void }) {
  const [form, setForm] = useState({
    date: match.date,
    time: match.time,
    location: match.location,
    price_per_player: match.price_per_player,
    payment_responsible_name: match.payment_responsible_name ?? "",
    payment_key: match.payment_key ?? "",
    payment_key_type: match.payment_key_type ?? "",
    payment_deadline: match.payment_deadline ?? "",
    payment_note: match.payment_note ?? "",
    active_capacity: match.active_capacity,
    status: match.status
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateMatch({ id: match.id, ...form });
    onSaved();
  }

  return (
    <section className="card">
      <h2 className="text-xl font-black text-ink">Partido semanal</h2>
      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <label className="grid gap-2">
          <span className="label">Fecha</span>
          <input className="field" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
        </label>
        <label className="grid gap-2">
          <span className="label">Hora</span>
          <input className="field" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
        </label>
        <label className="grid gap-2">
          <span className="label">Lugar</span>
          <input className="field" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
        </label>
        <label className="grid gap-2">
          <span className="label">Valor por jugador</span>
          <input
            className="field"
            type="number"
            value={form.price_per_player}
            onChange={(event) => setForm({ ...form, price_per_player: Number(event.target.value) })}
          />
        </label>
        <label className="grid gap-2">
          <span className="label">Responsable del pago</span>
          <input className="field" value={form.payment_responsible_name} onChange={(event) => setForm({ ...form, payment_responsible_name: event.target.value })} />
        </label>
        <label className="grid gap-2">
          <span className="label">Tipo de llave</span>
          <input className="field" placeholder="Nequi, Daviplata, Bancolombia" value={form.payment_key_type} onChange={(event) => setForm({ ...form, payment_key_type: event.target.value })} />
        </label>
        <label className="grid gap-2">
          <span className="label">Llave de pago</span>
          <input className="field" value={form.payment_key} onChange={(event) => setForm({ ...form, payment_key: event.target.value })} />
        </label>
        <label className="grid gap-2">
          <span className="label">Fecha límite de pago</span>
          <input className="field" value={form.payment_deadline} onChange={(event) => setForm({ ...form, payment_deadline: event.target.value })} />
        </label>
        <label className="grid gap-2 sm:col-span-2">
          <span className="label">Nota de pago</span>
          <textarea className="field min-h-24" value={form.payment_note} onChange={(event) => setForm({ ...form, payment_note: event.target.value })} />
        </label>
        <label className="grid gap-2">
          <span className="label">Cupo activo</span>
          <select
            className="field"
            value={form.active_capacity}
            onChange={(event) => setForm({ ...form, active_capacity: Number(event.target.value) as 12 | 18 | 20 })}
          >
            <option value={12}>12 jugadores</option>
            <option value={18}>18 jugadores</option>
            <option value={20}>20 jugadores</option>
          </select>
        </label>
        <label className="grid gap-2">
          <span className="label">Estado</span>
          <select className="field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as MatchStatus })}>
            <option value="open">Abierto</option>
            <option value="closed">Cerrado</option>
            <option value="finished">Finalizado</option>
          </select>
        </label>
        <button className="primary-button sm:col-span-2">
          <Save size={18} />
          Guardar partido
        </button>
      </form>
    </section>
  );
}

function CancellationsAdmin({
  match,
  cancellations,
  onChanged
}: {
  match: Match;
  cancellations: CancellationWithPlayer[];
  onChanged: () => void;
}) {
  async function decide(id: string, decision: AdminDecision) {
    await updateCancellationDecision(id, decision);
    onChanged();
  }

  return (
    <section className="card">
      <h2 className="text-xl font-black text-ink">Cancelaciones</h2>
      <div className="mt-4 grid gap-3">
        {cancellations.length ? (
          cancellations.map((cancellation) => (
            <div key={cancellation.id} className="grid gap-3 rounded-lg border border-ink/10 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-black text-ink">{cancellation.player.name}</p>
                  <p className="text-sm font-semibold text-ink/55">{new Date(cancellation.created_at).toLocaleString("es-CO")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isSameMonday(match.date, cancellation.created_at) ? <span className="status-pill bg-clay/15 text-clay">Mismo lunes</span> : null}
                  {cancellation.has_replacement ? <span className="status-pill bg-mint text-pitch">Con reemplazo</span> : null}
                </div>
              </div>
              <p className="text-sm font-semibold text-ink/70">
                Acción: {cancellation.action_type} · Estado anterior: {cancellation.previous_status ?? cancellation.declared_status}
              </p>
              {cancellation.possible_debt ? <p className="text-sm font-bold text-clay">Posible deuda por cancelación el lunes.</p> : null}
              {cancellation.replacement_name ? <p className="text-sm font-semibold text-ink/70">Reemplazo: {cancellation.replacement_name}</p> : null}
              {cancellation.promoted_player ? (
                <p className="text-sm font-semibold text-pitch">{cancellation.promoted_player.name} subió desde lista de espera.</p>
              ) : null}
              {cancellation.note ? <p className="rounded-lg bg-line/70 p-3 text-sm font-semibold text-ink/70">{cancellation.note}</p> : null}
              <select className="field" value={cancellation.admin_decision} onChange={(event) => decide(cancellation.id, event.target.value as AdminDecision)}>
                <option value="pending">Pendiente</option>
                <option value="waived">Sin deuda</option>
                <option value="debt">Debe cupo</option>
                <option value="replaced">Reemplazado</option>
              </select>
            </div>
          ))
        ) : (
          <p className="rounded-lg bg-line/70 p-4 text-sm font-semibold text-ink/65">No hay cancelaciones.</p>
        )}
      </div>
    </section>
  );
}

function WhatsAppBox({
  summary,
  includeDebts,
  setIncludeDebts
}: {
  summary: string;
  includeDebts: boolean;
  setIncludeDebts: (value: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <section className="card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-black text-ink">Mensaje para WhatsApp</h2>
        <label className="flex items-center gap-2 text-sm font-bold text-ink/70">
          <input className="size-5 accent-pitch" type="checkbox" checked={includeDebts} onChange={(event) => setIncludeDebts(event.target.checked)} />
          Incluir deudas
        </label>
      </div>
      <textarea className="field mt-4 min-h-72 font-mono text-sm" value={summary} readOnly />
      <button className="primary-button mt-3 w-full" onClick={copy}>
        <Clipboard size={18} />
        {copied ? "Copiado" : "Copiar resumen"}
      </button>
    </section>
  );
}
