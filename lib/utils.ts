import type {
  AppData,
  Cancellation,
  Match,
  Player,
  Registration,
  RegistrationStatus,
  RegistrationWithPlayer
} from "./types";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${date}T12:00:00`));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(value);
}

export function isSameMonday(matchDate: string, createdAt: string) {
  const match = new Date(`${matchDate}T12:00:00`);
  const created = new Date(createdAt);
  return (
    match.getDay() === 1 &&
    created.getFullYear() === match.getFullYear() &&
    created.getMonth() === match.getMonth() &&
    created.getDate() === match.getDate()
  );
}

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function statusForPosition(position: number, capacity: Match["active_capacity"]): RegistrationStatus {
  return position <= capacity ? "confirmed" : "waitlist";
}

export function registrationsForMatch(data: AppData, matchId: string): RegistrationWithPlayer[] {
  return data.registrations
    .filter((registration) => registration.match_id === matchId)
    .map((registration) => ({
      ...registration,
      player: data.players.find((player) => player.id === registration.player_id)!
    }))
    .filter((registration) => Boolean(registration.player))
    .sort((a, b) => a.position - b.position);
}

export function activeRegistrationsForMatch(data: AppData, match: Match) {
  return registrationsForMatch(data, match.id).map((registration) => ({
    ...registration,
    status:
      registration.status === "cancelled" || registration.status === "replacement"
        ? registration.status
        : statusForPosition(registration.position, match.active_capacity)
  }));
}

export function findOrCreatePlayer(players: Player[], name: string, phone?: string) {
  const normalized = normalizeName(name);
  const existing = players.find((player) => player.name.toLowerCase() === normalized.toLowerCase());

  if (existing) {
    return {
      player: { ...existing, phone: phone || existing.phone },
      isNew: false
    };
  }

  const now = new Date().toISOString();
  return {
    player: {
      id: crypto.randomUUID(),
      name: normalized,
      phone: phone?.trim() || null,
      created_at: now
    },
    isNew: true
  };
}

export function possibleDebt(match: Match, registration: Registration | undefined, cancellation: Cancellation) {
  return (
    registration?.status === "confirmed" &&
    isSameMonday(match.date, cancellation.created_at) &&
    !cancellation.has_replacement
  );
}

export function generateWhatsAppSummary(
  match: Match,
  registrations: RegistrationWithPlayer[],
  includeDebts: boolean,
  payments: AppData["payments"],
  players: AppData["players"]
) {
  const active = registrations.map((registration) => ({
    ...registration,
    status:
      registration.status === "cancelled" || registration.status === "replacement"
        ? registration.status
        : statusForPosition(registration.position, match.active_capacity)
  }));
  const confirmed = active.filter((registration) => registration.status === "confirmed");
  const waitlist = active.filter((registration) => registration.status === "waitlist");
  const debts = payments.filter((payment) => payment.match_id === match.id && payment.status === "pending");

  const debtLines = debts.map((payment) => {
    const player = players.find((item) => item.id === payment.player_id);
    return `- ${player?.name ?? "Jugador"}: ${formatCurrency(payment.amount)}${payment.reason ? ` (${payment.reason})` : ""}`;
  });

  return [
    `Fútbol Lunes - ${formatDate(match.date)}`,
    `Hora: ${match.time}`,
    `Lugar: ${match.location}`,
    `Valor por persona: ${formatCurrency(match.price_per_player)}`,
    "",
    "Confirmados:",
    ...confirmed.map((registration, index) => `${index + 1}. ${registration.player.name}`),
    "",
    "Lista de espera:",
    waitlist.length ? waitlist.map((registration, index) => `${index + 1}. ${registration.player.name}`).join("\n") : "Sin lista de espera",
    "",
    "Regla: si estás confirmado y cancelas el mismo lunes sin reemplazo, debes pagar tu cupo.",
    includeDebts && debtLines.length ? `\nDeudas pendientes:\n${debtLines.join("\n")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}
