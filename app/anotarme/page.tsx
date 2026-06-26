"use client";

import Link from "next/link";
import { CheckCircle2, Send } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { registerPlayer } from "@/lib/store";
import type { RegistrationStatus } from "@/lib/types";
import {
  getRememberedPlayers,
  phoneForRememberedPlayer,
  rememberPlayer,
  type RememberedPlayer
} from "@/lib/name-memory";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [rememberedPlayers, setRememberedPlayers] = useState<RememberedPlayer[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRememberedPlayers(getRememberedPlayers());
  }, []);

  function updateName(nextName: string) {
    setName(nextName);
    const rememberedPhone = phoneForRememberedPlayer(nextName);
    if (rememberedPhone && !phone) {
      setPhone(rememberedPhone);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const result = await registerPlayer({ name, phone, acceptedTerms });
      rememberPlayer(name, phone);
      setRememberedPlayers(getRememberedPlayers());
      setStatus(result.status);
      setMessage(
        result.status === "confirmed"
          ? "Estás confirmado para el partido. Recuerda que si cancelas el lunes sin reemplazo, debes pagar tu cupo."
          : "Quedaste en lista de espera. Si alguien cancela, podrías subir automáticamente a confirmado."
      );
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "No se pudo guardar la inscripción.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <section className="card">
        <h1 className="text-2xl font-black text-ink">Anotarme</h1>
        <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2">
            <span className="label">Nombre completo</span>
            <input
              className="field"
              value={name}
              onChange={(event) => updateName(event.target.value)}
              list="remembered-player-names"
              autoComplete="name"
              required
              minLength={3}
            />
            <datalist id="remembered-player-names">
              {rememberedPlayers.map((player) => (
                <option key={player.name} value={player.name} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-2">
            <span className="label">WhatsApp opcional</span>
            <input className="field" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
          </label>
          <label className="flex items-start gap-3 rounded-lg bg-line/70 p-4 text-sm font-semibold text-ink/75">
            <input
              className="mt-1 size-5 accent-pitch"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              required
            />
            Acepto que si quedo confirmado y cancelo el mismo lunes sin reemplazo, debo pagar mi cupo.
          </label>
          {error ? <p className="rounded-lg bg-clay/10 p-3 text-sm font-bold text-clay">{error}</p> : null}
          <button className="primary-button" disabled={loading}>
            <Send size={20} />
            {loading ? "Guardando..." : "Enviar inscripción"}
          </button>
        </form>
      </section>

      {status ? (
        <section className="card">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-pitch" size={28} />
            <div>
              <StatusPill status={status === "confirmed" ? "confirmed" : "waitlist"} />
              <p className="mt-2 font-bold text-ink">{message}</p>
            </div>
          </div>
          <Link href="/lista" className="secondary-button mt-4 w-full">
            Ver lista
          </Link>
        </section>
      ) : null}
    </div>
  );
}
