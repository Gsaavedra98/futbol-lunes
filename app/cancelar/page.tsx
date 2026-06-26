"use client";

import { FormEvent, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { cancelRegistration } from "@/lib/store";
import type { CancellationAction, DeclaredStatus } from "@/lib/types";
import { getRememberedPlayers, rememberPlayer, type RememberedPlayer } from "@/lib/name-memory";

export default function CancelPage() {
  const [name, setName] = useState("");
  const [rememberedPlayers, setRememberedPlayers] = useState<RememberedPlayer[]>([]);
  const [actionType, setActionType] = useState<CancellationAction>("cancel");
  const [declaredStatus, setDeclaredStatus] = useState<DeclaredStatus>("unknown");
  const [hasReplacement, setHasReplacement] = useState(false);
  const [replacementName, setReplacementName] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRememberedPlayers(getRememberedPlayers());
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await cancelRegistration({ name, actionType, declaredStatus, hasReplacement, replacementName, note });
      rememberPlayer(name);
      setRememberedPlayers(getRememberedPlayers());
      setMessage(
        result.possibleDebt
          ? "Cancelación recibida. Como parece ser lunes y estabas confirmado sin reemplazo, queda como posible deuda para revisión del administrador."
          : result.previousStatus === "waitlist"
            ? "Tu cancelación fue registrada. Saliste de la lista de espera."
            : result.previousStatus === "confirmed"
              ? "Tu cancelación fue registrada. No generas deuda."
              : "Cancelación recibida. El administrador revisará el caso y ajustará la lista."
      );
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "No se pudo guardar la cancelación.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <section className="card">
        <h1 className="text-2xl font-black text-ink">Cancelar asistencia</h1>
        <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2">
            <span className="label">Nombre completo</span>
            <input
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              list="remembered-cancel-player-names"
              autoComplete="name"
              required
              minLength={3}
            />
            <datalist id="remembered-cancel-player-names">
              {rememberedPlayers.map((player) => (
                <option key={player.name} value={player.name} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-2">
            <span className="label">Acción</span>
            <select className="field" value={actionType} onChange={(event) => setActionType(event.target.value as CancellationAction)}>
              <option value="cancel">Cancelar asistencia</option>
              <option value="cancel_with_replacement">Cancelar y reportar reemplazo</option>
              <option value="replacement">Soy reemplazo</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="label">Estado declarado</span>
            <select className="field" value={declaredStatus} onChange={(event) => setDeclaredStatus(event.target.value as DeclaredStatus)}>
              <option value="confirmed">Confirmado</option>
              <option value="waitlist">Lista de espera</option>
              <option value="unknown">No estoy seguro</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-4 rounded-lg bg-line/70 p-4 font-bold text-ink">
            ¿Tienes reemplazo?
            <input
              className="size-6 accent-pitch"
              type="checkbox"
              checked={hasReplacement}
              onChange={(event) => setHasReplacement(event.target.checked)}
            />
          </label>
          <label className="grid gap-2">
            <span className="label">Nombre del reemplazo</span>
            <input className="field" value={replacementName} onChange={(event) => setReplacementName(event.target.value)} />
          </label>
          <label className="grid gap-2">
            <span className="label">Observación opcional</span>
            <textarea className="field min-h-28" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          {error ? <p className="rounded-lg bg-clay/10 p-3 text-sm font-bold text-clay">{error}</p> : null}
          {message ? <p className="rounded-lg bg-mint/50 p-3 text-sm font-bold text-pitch">{message}</p> : null}
          <button className="primary-button" disabled={loading}>
            <Send size={20} />
            {loading ? "Guardando..." : "Enviar cancelación"}
          </button>
        </form>
      </section>
    </div>
  );
}
