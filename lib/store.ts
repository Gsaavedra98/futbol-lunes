"use client";

import { loadDemoData, saveDemoData } from "./demo-storage";
import type {
  AdminDecision,
  AppData,
  Attendance,
  Cancellation,
  CancellationAction,
  DeclaredStatus,
  Match,
  MatchStatus,
  PaymentStatus,
  Registration,
  RegistrationStatus
} from "./types";
import {
  activeRegistrationsForMatch,
  findOrCreatePlayer,
  normalizeName,
  possibleDebt,
  recalculateMatchRegistrations,
  registrationsForMatch,
} from "./utils";

const databaseNotConfigured = "La base de datos no está configurada";

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "No se pudo completar la operación.");
  }
  return payload as T;
}

function canFallbackToDemo(error: unknown) {
  return process.env.NODE_ENV === "development" && error instanceof Error && error.message === databaseNotConfigured;
}

export async function getData() {
  try {
    const payload = await readJson<{ data: AppData }>(await fetch("/api/public-data", { cache: "no-store" }));
    return payload.data;
  } catch (error) {
    if (canFallbackToDemo(error)) {
      return loadDemoData();
    }
    throw error;
  }
}

export async function getAdminData() {
  try {
    const payload = await readJson<{ data: AppData }>(await fetch("/api/admin/data", { cache: "no-store" }));
    return payload.data;
  } catch (error) {
    if (canFallbackToDemo(error)) {
      return loadDemoData();
    }
    throw error;
  }
}

export function getCurrentMatch(data: AppData) {
  return [...data.matches].sort((a, b) => a.date.localeCompare(b.date))[0];
}

export async function registerPlayer(input: { name: string; phone?: string; acceptedTerms: boolean }) {
  try {
    return await readJson<{
      status: RegistrationStatus;
      registration: Registration & { player: { id: string; name: string; phone: null; created_at: string } };
    }>(
      await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      })
    );
  } catch (error) {
    if (!canFallbackToDemo(error)) {
      throw error;
    }

    const data = loadDemoData();
    const match = getCurrentMatch(data);
    const normalizedName = normalizeName(input.name);

    if (!match || match.status !== "open") {
      throw new Error("El partido no está abierto para inscripciones.");
    }
    if (!normalizedName || normalizedName.length < 3) {
      throw new Error("Escribe tu nombre completo.");
    }
    if (!input.acceptedTerms) {
      throw new Error("Debes aceptar la regla de cancelación para anotarte.");
    }

    const alreadyRegistered = registrationsForMatch(data, match.id).find(
      (registration) =>
        registration.status !== "cancelled" &&
        registration.player.name.toLowerCase() === normalizedName.toLowerCase()
    );

    if (alreadyRegistered) {
      throw new Error("Ya tienes una inscripción activa para este partido.");
    }

    const playerResult = findOrCreatePlayer(data.players, normalizedName, input.phone);
    const nextPlayers = playerResult.isNew
      ? [...data.players, playerResult.player]
      : data.players.map((player) => (player.id === playerResult.player.id ? playerResult.player : player));
    const now = new Date().toISOString();
    const registration: Registration = {
      id: crypto.randomUUID(),
      match_id: match.id,
      player_id: playerResult.player.id,
      position: 9999,
      status: "waitlist",
      accepted_terms: true,
      created_at: now
    };
    const registrations = recalculateMatchRegistrations([...data.registrations, registration], match);
    const savedRegistration = registrations.find((item) => item.id === registration.id) ?? registration;

    saveDemoData({ ...data, players: nextPlayers, registrations });
    return { status: savedRegistration.status, registration: { ...savedRegistration, player: playerResult.player } };
  }
}

export async function cancelRegistration(input: {
  name: string;
  actionType: CancellationAction;
  declaredStatus: DeclaredStatus;
  hasReplacement: boolean;
  replacementName?: string;
  note?: string;
}) {
  try {
    return await readJson<{ possibleDebt: boolean; previousStatus?: RegistrationStatus | null; promotedPlayerId?: string | null }>(
      await fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      })
    );
  } catch (error) {
    if (!canFallbackToDemo(error)) {
      throw error;
    }

    const data = loadDemoData();
    const match = getCurrentMatch(data);
    const normalizedName = normalizeName(input.name);
    if (!match) throw new Error("No hay partido activo.");
    if (!normalizedName || normalizedName.length < 3) throw new Error("Escribe tu nombre completo.");

    const playerResult = findOrCreatePlayer(data.players, normalizedName);
    const registration = data.registrations.find(
      (item) => item.match_id === match.id && item.player_id === playerResult.player.id && item.status !== "cancelled"
    );
    const now = new Date().toISOString();
    const cancellation: Cancellation = {
      id: crypto.randomUUID(),
      match_id: match.id,
      player_id: playerResult.player.id,
      action_type: input.actionType,
      declared_status: input.declaredStatus,
      has_replacement: input.hasReplacement,
      replacement_name: input.replacementName?.trim() || null,
      note: input.note?.trim() || null,
      admin_decision: "pending",
      created_at: now
    };
    const previousStatus = registration?.status;
    const debt = possibleDebt(match, registration, cancellation);
    const waitlistBefore = activeRegistrationsForMatch(data, match).find((item) => item.status === "waitlist");
    const registrations = registration
      ? recalculateMatchRegistrations(
          data.registrations.map((item) => (item.id === registration.id ? { ...item, status: "cancelled" } : item)),
          match
        )
      : data.registrations;
    const promotedPlayerId =
      previousStatus === "confirmed" && waitlistBefore ? waitlistBefore.player_id : null;

    saveDemoData({
      ...data,
      players: playerResult.isNew ? [...data.players, playerResult.player] : data.players,
      registrations,
      cancellations: [{ ...cancellation, previous_status: previousStatus, possible_debt: debt, promoted_player_id: promotedPlayerId }, ...data.cancellations],
      payments: debt
        ? [
            {
              id: crypto.randomUUID(),
              match_id: match.id,
              player_id: playerResult.player.id,
              amount: match.price_per_player,
              status: "pending",
              reason: "Cancelación el mismo lunes sin reemplazo confirmado",
              created_at: now
            },
            ...data.payments
          ]
        : data.payments
    });

    return { possibleDebt: debt, previousStatus, promotedPlayerId };
  }
}

export async function reportPayment(input: {
  name: string;
  method: string;
  amount: number | string;
  reference?: string;
  comment?: string;
}) {
  const response = await fetch("/api/report-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  return readJson<{ ok: true }>(response);
}

async function adminAction(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  return readJson<{ ok: true }>(response);
}

export async function updateMatch(input: {
  id?: string;
  date: string;
  time: string;
  location: string;
  price_per_player: number;
  payment_responsible_name?: string | null;
  payment_key?: string | null;
  payment_key_type?: string | null;
  payment_deadline?: string | null;
  payment_note?: string | null;
  active_capacity: 12 | 18 | 20;
  status: MatchStatus;
}) {
  try {
    await adminAction({ action: "updateMatch", match: input });
  } catch (error) {
    if (!canFallbackToDemo(error)) throw error;
    const data = loadDemoData();
    const current = getCurrentMatch(data);
    const now = new Date().toISOString();
    const match: Match = current ? { ...current, ...input } : { id: crypto.randomUUID(), created_at: now, ...input };
    const registrations = recalculateMatchRegistrations(data.registrations, match);
    saveDemoData({
      ...data,
      matches: current ? data.matches.map((item) => (item.id === current.id ? match : item)) : [match, ...data.matches],
      registrations
    });
  }
}

export async function updateRegistrationStatus(registrationId: string, status: Registration["status"]) {
  try {
    await adminAction({ action: "updateRegistrationStatus", registrationId, status });
  } catch (error) {
    if (!canFallbackToDemo(error)) throw error;
    const data = loadDemoData();
    const nextRegistrations = data.registrations.map((registration) =>
      registration.id === registrationId ? { ...registration, status } : registration
    );
    const changed = nextRegistrations.find((registration) => registration.id === registrationId);
    const match = changed ? data.matches.find((item) => item.id === changed.match_id) : null;
    saveDemoData({
      ...data,
      registrations: match ? recalculateMatchRegistrations(nextRegistrations, match) : nextRegistrations
    });
  }
}

export async function updateCancellationDecision(cancellationId: string, decision: AdminDecision) {
  try {
    await adminAction({ action: "updateCancellationDecision", cancellationId, decision });
  } catch (error) {
    if (!canFallbackToDemo(error)) throw error;
    const data = loadDemoData();
    saveDemoData({
      ...data,
      cancellations: data.cancellations.map((cancellation) =>
        cancellation.id === cancellationId ? { ...cancellation, admin_decision: decision } : cancellation
      )
    });
  }
}

export async function upsertAttendance(matchId: string, playerId: string, attended: boolean) {
  try {
    await adminAction({ action: "upsertAttendance", matchId, playerId, attended });
  } catch (error) {
    if (!canFallbackToDemo(error)) throw error;
    const data = loadDemoData();
    const existing = data.attendance.find((item) => item.match_id === matchId && item.player_id === playerId);
    const attendance: Attendance = {
      id: existing?.id ?? crypto.randomUUID(),
      match_id: matchId,
      player_id: playerId,
      attended,
      notes: existing?.notes ?? null,
      created_at: existing?.created_at ?? new Date().toISOString()
    };
    saveDemoData({
      ...data,
      attendance: existing ? data.attendance.map((item) => (item.id === existing.id ? attendance : item)) : [attendance, ...data.attendance]
    });
  }
}

export async function updatePayment(matchId: string, playerId: string, amount: number, status: PaymentStatus) {
  try {
    await adminAction({ action: "upsertPayment", matchId, playerId, amount, status });
  } catch (error) {
    if (!canFallbackToDemo(error)) throw error;
    const data = loadDemoData();
    const existing = data.payments.find((item) => item.match_id === matchId && item.player_id === playerId);
    const payment = {
      id: existing?.id ?? crypto.randomUUID(),
      match_id: matchId,
      player_id: playerId,
      amount,
      status,
      reason: status === "paid" ? "Pago registrado por admin" : status === "waived" ? "Deuda exonerada por admin" : "Pendiente de pago",
      created_at: existing?.created_at ?? new Date().toISOString()
    };
    saveDemoData({
      ...data,
      payments: existing ? data.payments.map((item) => (item.id === existing.id ? payment : item)) : [payment, ...data.payments]
    });
  }
}

export function getPublicLists(data: AppData, match: Match) {
  const active = activeRegistrationsForMatch(data, match).filter((registration) => registration.status !== "cancelled");
  return {
    confirmed: active.filter((registration) => registration.status === "confirmed"),
    waitlist: active.filter((registration) => registration.status === "waitlist"),
    available: Math.max(match.active_capacity - active.filter((registration) => registration.status === "confirmed").length, 0)
  };
}
