"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { reportPayment } from "@/lib/store";
import {
  getPlayerSuggestions,
  rememberPlayer,
  type RememberedPlayer
} from "@/lib/name-memory";

export default function PaymentReportPage() {
  const [name, setName] = useState("");
  const [method, setMethod] = useState("Nequi");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [comment, setComment] = useState("");
  const [players, setPlayers] = useState<RememberedPlayer[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPlayerSuggestions().then(setPlayers);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await reportPayment({
        name,
        method,
        amount,
        reference,
        comment
      });
      rememberPlayer(name);
      setPlayers(await getPlayerSuggestions());
      setMessage("Tu pago fue reportado. El administrador lo revisará y lo marcará como pagado.");
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "No se pudo reportar el pago.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <section className="card">
        <h1 className="text-2xl font-black text-ink">Reportar pago</h1>
        <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2">
            <span className="label">Nombre del jugador</span>
            <input
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              list="payment-player-names"
              autoComplete="name"
              required
              minLength={3}
            />
            <datalist id="payment-player-names">
              {players.map((player) => (
                <option key={player.name} value={player.name} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-2">
            <span className="label">Método de pago</span>
            <input className="field" value={method} onChange={(event) => setMethod(event.target.value)} required />
          </label>
          <label className="grid gap-2">
            <span className="label">Valor pagado</span>
            <input className="field" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" required />
          </label>
          <label className="grid gap-2">
            <span className="label">Referencia o comprobante opcional</span>
            <input className="field" value={reference} onChange={(event) => setReference(event.target.value)} />
          </label>
          <label className="grid gap-2">
            <span className="label">Comentario opcional</span>
            <textarea className="field min-h-24" value={comment} onChange={(event) => setComment(event.target.value)} />
          </label>
          {error ? <p className="rounded-lg bg-clay/10 p-3 text-sm font-bold text-clay">{error}</p> : null}
          {message ? (
            <p className="flex gap-2 rounded-lg bg-mint/50 p-3 text-sm font-bold text-pitch">
              <CheckCircle2 size={18} />
              {message}
            </p>
          ) : null}
          <button className="primary-button" disabled={loading}>
            <Send size={20} />
            {loading ? "Enviando..." : "Reportar pago"}
          </button>
        </form>
      </section>
    </div>
  );
}
