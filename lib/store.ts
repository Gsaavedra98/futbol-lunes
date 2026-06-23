"use client";

import { seedData } from "./seed";
import { hasSupabaseConfig, supabase } from "./supabase";
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
  Registration
} from "./types";
import {
  activeRegistrationsForMatch,
  findOrCreatePlayer,
  normalizeName,
  possibleDebt,
  registrationsForMatch,
  statusForPosition
} from "./utils";

const STORE_KEY = "futbol-lunes-data";

function loadLocalData(): AppData {
  if (typeof window === "undefined") {
    return seedData;
  }

  const stored = window.localStorage.getItem(STORE_KEY);
  if (!stored) {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(seedData));
    return seedData;
  }

  try {
    return JSON.parse(stored) as AppData;
  } catch {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(seedData));
    return seedData;
  }
}

function saveLocalData(data: AppData) {
  window.localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

async function loadSupabaseData(): Promise<AppData | null> {
  if (!supabase) {
    return null;
  }

  const [matches, players, registrations, cancellations, payments, attendance] = await Promise.all([
    supabase.from("matches").select("*").order("date", { ascending: true }),
    supabase.from("players").select("*").order("created_at", { ascending: true }),
    supabase.from("registrations").select("*").order("position", { ascending: true }),
    supabase.from("cancellations").select("*").order("created_at", { ascending: false }),
    supabase.from("payments").select("*").order("created_at", { ascending: false }),
    supabase.from("attendance").select("*").order("created_at", { ascending: false })
  ]);

  if ([matches, players, registrations, cancellations, payments, attendance].some((result) => result.error)) {
    return null;
  }

  return {
    matches: matches.data ?? [],
    players: players.data ?? [],
    registrations: registrations.data ?? [],
    cancellations: cancellations.data ?? [],
    payments: payments.data ?? [],
    attendance: attendance.data ?? []
  } as AppData;
}

async function persistSupabaseData(data: AppData) {
  if (!supabase) {
    return;
  }

  await Promise.all([
    supabase.from("matches").upsert(data.matches),
    supabase.from("players").upsert(data.players),
    supabase.from("registrations").upsert(data.registrations),
    supabase.from("cancellations").upsert(data.cancellations),
    supabase.from("payments").upsert(data.payments),
    supabase.from("attendance").upsert(data.attendance)
  ]);
}

export async function getData() {
  if (hasSupabaseConfig) {
    const remote = await loadSupabaseData();
    if (remote && remote.matches.length) {
      return remote;
    }
  }

  return loadLocalData();
}

export async function saveData(data: AppData) {
  saveLocalData(data);
  if (hasSupabaseConfig) {
    await persistSupabaseData(data);
  }
}

export function getCurrentMatch(data: AppData) {
  return [...data.matches].sort((a, b) => a.date.localeCompare(b.date))[0];
}

export async function registerPlayer(input: { name: string; phone?: string; acceptedTerms: boolean }) {
  const data = await getData();
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
      registration.player.name.toLowerCase() === normalizedName.toLowerCase() &&
      registration.status !== "cancelled"
  );

  if (alreadyRegistered) {
    return {
      match,
      registration: alreadyRegistered,
      status: alreadyRegistered.status
    };
  }

  const playerResult = findOrCreatePlayer(data.players, normalizedName, input.phone);
  const nextPlayers = playerResult.isNew
    ? [...data.players, playerResult.player]
    : data.players.map((player) => (player.id === playerResult.player.id ? playerResult.player : player));
  const position = registrationsForMatch(data, match.id).filter((registration) => registration.status !== "cancelled").length + 1;
  const status = statusForPosition(position, match.active_capacity);
  const now = new Date().toISOString();
  const registration: Registration = {
    id: crypto.randomUUID(),
    match_id: match.id,
    player_id: playerResult.player.id,
    position,
    status,
    accepted_terms: true,
    created_at: now
  };

  await saveData({
    ...data,
    players: nextPlayers,
    registrations: [...data.registrations, registration]
  });

  return {
    match,
    registration: { ...registration, player: playerResult.player },
    status
  };
}

export async function cancelRegistration(input: {
  name: string;
  actionType: CancellationAction;
  declaredStatus: DeclaredStatus;
  hasReplacement: boolean;
  replacementName?: string;
  note?: string;
}) {
  const data = await getData();
  const match = getCurrentMatch(data);
  const normalizedName = normalizeName(input.name);

  if (!match) {
    throw new Error("No hay partido activo.");
  }

  if (!normalizedName || normalizedName.length < 3) {
    throw new Error("Escribe tu nombre completo.");
  }

  const playerResult = findOrCreatePlayer(data.players, normalizedName);
  const registration = data.registrations.find(
    (item) =>
      item.match_id === match.id &&
      item.player_id === playerResult.player.id &&
      item.status !== "cancelled"
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
  const debt = possibleDebt(match, registration, cancellation);
  const payment = debt
    ? {
        id: crypto.randomUUID(),
        match_id: match.id,
        player_id: playerResult.player.id,
        amount: match.price_per_player,
        status: "pending" as PaymentStatus,
        reason: "Cancelación el mismo lunes sin reemplazo confirmado",
        created_at: now
      }
    : null;

  await saveData({
    ...data,
    players: playerResult.isNew ? [...data.players, playerResult.player] : data.players,
    registrations: registration
      ? data.registrations.map((item) => (item.id === registration.id ? { ...item, status: "cancelled" } : item))
      : data.registrations,
    cancellations: [cancellation, ...data.cancellations],
    payments: payment ? [payment, ...data.payments] : data.payments
  });

  return { match, cancellation, possibleDebt: debt };
}

export async function updateMatch(input: {
  date: string;
  time: string;
  location: string;
  price_per_player: number;
  active_capacity: 12 | 18 | 20;
  status: MatchStatus;
}) {
  const data = await getData();
  const current = getCurrentMatch(data);
  const now = new Date().toISOString();
  const match: Match = current
    ? { ...current, ...input }
    : { id: crypto.randomUUID(), created_at: now, ...input };

  const registrations = data.registrations.map((registration) =>
    registration.match_id === match.id && registration.status !== "cancelled" && registration.status !== "replacement"
      ? { ...registration, status: statusForPosition(registration.position, match.active_capacity) }
      : registration
  );

  await saveData({
    ...data,
    matches: current ? data.matches.map((item) => (item.id === current.id ? match : item)) : [match, ...data.matches],
    registrations
  });
}

export async function updateRegistrationStatus(registrationId: string, status: Registration["status"]) {
  const data = await getData();
  await saveData({
    ...data,
    registrations: data.registrations.map((registration) =>
      registration.id === registrationId ? { ...registration, status } : registration
    )
  });
}

export async function updateCancellationDecision(cancellationId: string, decision: AdminDecision) {
  const data = await getData();
  await saveData({
    ...data,
    cancellations: data.cancellations.map((cancellation) =>
      cancellation.id === cancellationId ? { ...cancellation, admin_decision: decision } : cancellation
    )
  });
}

export async function upsertAttendance(playerId: string, attended: boolean) {
  const data = await getData();
  const match = getCurrentMatch(data);
  if (!match) return;

  const existing = data.attendance.find((item) => item.match_id === match.id && item.player_id === playerId);
  const attendance: Attendance = {
    id: existing?.id ?? crypto.randomUUID(),
    match_id: match.id,
    player_id: playerId,
    attended,
    notes: existing?.notes ?? null,
    created_at: existing?.created_at ?? new Date().toISOString()
  };

  await saveData({
    ...data,
    attendance: existing
      ? data.attendance.map((item) => (item.id === existing.id ? attendance : item))
      : [attendance, ...data.attendance]
  });
}

export async function updatePayment(playerId: string, status: PaymentStatus) {
  const data = await getData();
  const match = getCurrentMatch(data);
  if (!match) return;

  const existing = data.payments.find((item) => item.match_id === match.id && item.player_id === playerId);
  const payment = {
    id: existing?.id ?? crypto.randomUUID(),
    match_id: match.id,
    player_id: playerId,
    amount: match.price_per_player,
    status,
    reason: status === "paid" ? "Pago registrado por admin" : status === "waived" ? "Deuda exonerada por admin" : "Pendiente de pago",
    created_at: existing?.created_at ?? new Date().toISOString()
  };

  await saveData({
    ...data,
    payments: existing ? data.payments.map((item) => (item.id === existing.id ? payment : item)) : [payment, ...data.payments]
  });
}

export function getPublicLists(data: AppData, match: Match) {
  const active = activeRegistrationsForMatch(data, match).filter((registration) => registration.status !== "cancelled");
  return {
    confirmed: active.filter((registration) => registration.status === "confirmed"),
    waitlist: active.filter((registration) => registration.status === "waitlist"),
    available: Math.max(match.active_capacity - active.filter((registration) => registration.status === "confirmed").length, 0)
  };
}
