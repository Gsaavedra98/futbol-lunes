import type {
  AppData,
  Cancellation,
  CancellationWithPlayer,
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

export function recalculateMatchRegistrations(
  registrations: Registration[],
  match: Pick<Match, "id" | "active_capacity">
) {
  let activePosition = 0;
  const active = registrations
    .filter((registration) => registration.match_id === match.id && registration.status !== "cancelled")
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .map((registration) => {
      activePosition += 1;
      return {
        ...registration,
        position: activePosition,
        status: statusForPosition(activePosition, match.active_capacity)
      };
    });
  const activeById = new Map(active.map((registration) => [registration.id, registration]));

  return registrations.map((registration) => activeById.get(registration.id) ?? registration);
}

export function registrationsForMatch(data: AppData, matchId: string): RegistrationWithPlayer[] {
  return data.registrations
    .filter((registration) => registration.match_id === matchId)
    .map((registration) => ({
      ...registration,
      player: data.players.find((player) => player.id === registration.player_id)!
    }))
    .filter((registration) => Boolean(registration.player))
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

export function activeRegistrationsForMatch(data: AppData, match: Match) {
  const recalculated = recalculateMatchRegistrations(data.registrations, match);
  return registrationsForMatch({ ...data, registrations: recalculated }, match.id);
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
  players: AppData["players"],
  cancellations: CancellationWithPlayer[] = []
) {
  const active = recalculateMatchRegistrations(registrations, match).filter(
    (registration) => registration.status !== "cancelled"
  ) as RegistrationWithPlayer[];
  const confirmed = active.filter((registration) => registration.status === "confirmed");
  const waitlist = active.filter((registration) => registration.status === "waitlist");
  const debts = payments.filter((payment) => payment.match_id === match.id && payment.status === "debt");
  const paymentStatusFor = (registration: RegistrationWithPlayer) => {
    const payment = payments.find(
      (item) => item.match_id === match.id && item.player_id === registration.player_id
    );
    return payment?.status === "paid" || registration.payment_status === "paid" ? "✅" : "⏳";
  };
  const cancellationLines = cancellations
    .filter((cancellation) => cancellation.match_id === match.id)
    .slice(0, 5)
    .map((cancellation) => {
      const promoted = cancellation.promoted_player?.name
        ? ` ${cancellation.promoted_player.name} sube desde lista de espera.`
        : "";
      const late = cancellation.possible_debt ? " Canceló el lunes." : "";
      return `- ${cancellation.player.name} canceló.${late}${promoted}`;
    });

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
    ...confirmed.map((registration, index) => `${index + 1}. ${registration.player.name} ${paymentStatusFor(registration)}`),
    "",
    "Lista de espera:",
    waitlist.length ? waitlist.map((registration, index) => `${index + 1}. ${registration.player.name} ${paymentStatusFor(registration)}`).join("\n") : "Sin lista de espera",
    "",
    "Pagos: ✅ Pagado · ⏳ Pendiente",
    "",
    "Regla: si estás confirmado y cancelas el mismo lunes sin reemplazo, debes pagar tu cupo.",
    cancellationLines.length ? `\nNovedades:\n${cancellationLines.join("\n")}` : "",
    includeDebts && debtLines.length ? `\nDeudas pendientes:\n${debtLines.join("\n")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}
