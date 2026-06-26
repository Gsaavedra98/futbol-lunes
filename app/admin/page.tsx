"use client";

import { Clipboard, Lock, RefreshCcw, Save } from "lucide-react";
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
      <RegistrationsAdmin data={data} match={match} registrations={registrations} onChanged={refresh} />
      <CancellationsAdmin match={match} cancellations={cancellations} onChanged={refresh} />
      <PaymentsAdmin data={data} match={match} registrations={registrations} onChanged={refresh} />
      <WhatsAppBox summary={summary} includeDebts={includeDebts} setIncludeDebts={setIncludeDebts} />
    </div>
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

function RegistrationsAdmin({
  registrations,
  onChanged
}: {
  data: AppData;
  match: Match;
  registrations: RegistrationWithPlayer[];
  onChanged: () => void;
}) {
  async function changeStatus(id: string, status: RegistrationStatus) {
    await updateRegistrationStatus(id, status);
    onChanged();
  }

  return (
    <section className="card">
      <h2 className="text-xl font-black text-ink">Inscritos</h2>
      <div className="mt-4 grid gap-3">
        {registrations.map((registration) => (
          <div key={registration.id} className="grid gap-3 rounded-lg border border-ink/10 p-3 sm:grid-cols-[64px_1fr_160px_180px] sm:items-center">
            <span className="font-black text-pitch">#{registration.position}</span>
            <div>
              <p className="font-black text-ink">{registration.player.name}</p>
              <p className="text-sm font-semibold text-ink/55">{new Date(registration.created_at).toLocaleString("es-CO")}</p>
            </div>
            <StatusPill status={registration.status === "confirmed" ? "confirmed" : registration.status === "waitlist" ? "waitlist" : registration.status} />
            <select className="field py-2" value={registration.status} onChange={(event) => changeStatus(registration.id, event.target.value as RegistrationStatus)}>
              <option value="confirmed">Confirmado</option>
              <option value="waitlist">Lista de espera</option>
              <option value="cancelled">Cancelado</option>
              <option value="replacement">Reemplazo</option>
            </select>
          </div>
        ))}
      </div>
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

function PaymentsAdmin({
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
  const activeRegistrations = useMemo(
    () => registrations.filter((registration) => registration.status === "confirmed" || registration.status === "waitlist"),
    [registrations]
  );

  async function attendance(playerId: string, attended: boolean) {
    await upsertAttendance(match.id, playerId, attended);
    onChanged();
  }

  async function payment(playerId: string, status: PaymentStatus) {
    await updatePayment(match.id, playerId, match.price_per_player, status);
    onChanged();
  }

  return (
    <section className="card">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-black text-ink">Pagos y asistencia</h2>
        <p className="text-sm font-semibold text-ink/60">
          {formatDate(match.date)} · {formatCurrency(match.price_per_player)}
        </p>
      </div>
      <div className="mt-4 grid gap-3">
        {activeRegistrations.map((registration) => {
          const attendanceRecord = data.attendance.find((item) => item.match_id === match.id && item.player_id === registration.player_id);
          const paymentRecord = data.payments.find((item) => item.match_id === match.id && item.player_id === registration.player_id);

          return (
            <div key={registration.id} className="grid gap-3 rounded-lg border border-ink/10 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-black text-ink">{registration.player.name}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <StatusPill status={registration.status === "confirmed" ? "confirmed" : "waitlist"} />
                    <span className="status-pill bg-line text-ink">{formatCurrency(match.price_per_player)}</span>
                  </div>
                </div>
                <StatusPill status={(paymentRecord?.status ?? "pending") as PaymentStatus} />
              </div>
              {paymentRecord ? (
                <div className="grid gap-1 rounded-lg bg-line/70 p-3 text-sm font-semibold text-ink/70 sm:grid-cols-2">
                  <p>Reportado: {paymentRecord.reported_amount ? formatCurrency(paymentRecord.reported_amount) : "Sin reporte"}</p>
                  <p>Método: {paymentRecord.method || "Sin método"}</p>
                  <p>Referencia: {paymentRecord.reference || "Sin referencia"}</p>
                  <p>Fecha: {paymentRecord.reported_at ? new Date(paymentRecord.reported_at).toLocaleString("es-CO") : "Sin fecha"}</p>
                  {paymentRecord.comment ? <p className="sm:col-span-2">Comentario: {paymentRecord.comment}</p> : null}
                </div>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                <select className="field py-2" value={attendanceRecord?.attended ? "yes" : "no"} onChange={(event) => attendance(registration.player_id, event.target.value === "yes")}>
                  <option value="yes">Asistió</option>
                  <option value="no">No asistió</option>
                </select>
                <select className="field py-2" value={paymentRecord?.status ?? "pending"} onChange={(event) => payment(registration.player_id, event.target.value as PaymentStatus)}>
                  <option value="pending">Pendiente</option>
                  <option value="pending_review">Por revisar</option>
                  <option value="paid">Pagado</option>
                  <option value="rejected">Rechazado</option>
                  <option value="debt">Deuda</option>
                  <option value="waived">Exonerado</option>
                </select>
              </div>
            </div>
          );
        })}
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
