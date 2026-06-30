import type {
  AdminDecision,
  AppData,
  Attendance,
  Cancellation,
  CancellationAction,
  DeclaredStatus,
  Match,
  MatchStatus,
  Payment,
  PaymentSettings,
  PaymentStatus,
  Player,
  Registration,
  RegistrationStatus
} from "@/lib/types";
import { normalizeName } from "@/lib/utils";
import {
  createAdminSupabaseClient,
  createPublicSupabaseClient,
  missingDatabaseMessage
} from "./supabase";

type PublicRegistrationRow = {
  id: string;
  match_id: string;
  position: number;
  status: RegistrationStatus;
  payment_status?: PaymentStatus | null;
  created_at: string;
  player_name: string;
};

type RegistrationRpcRow = {
  registration_id: string;
  result_match_id: string;
  result_position: number;
  result_status: RegistrationStatus;
};

type CancellationRpcRow = {
  cancellation_id: string;
  previous_status: RegistrationStatus | null;
  possible_debt: boolean;
  promoted_player_id: string | null;
};

function paymentSettingsFromMatch(match?: Match | null): PaymentSettings | null {
  if (!match) return null;
  return {
    id: "default",
    responsible_name: match.payment_responsible_name ?? null,
    payment_key: match.payment_key ?? null,
    payment_key_type: match.payment_key_type ?? null,
    payment_deadline: match.payment_deadline ?? null,
    payment_note: match.payment_note ?? null,
    updated_at: null
  };
}

export async function getPlayerSuggestionsFromSupabase() {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    throw new Error(missingDatabaseMessage);
  }

  const { data, error } = await supabase
    .from("registrations")
    .select("created_at, players(name, phone)")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    throw new Error(error.message);
  }

  const suggestions = new Map<string, { name: string; phone?: string }>();

  for (const row of data ?? []) {
    const player = Array.isArray(row.players) ? row.players[0] : row.players;
    const name = player?.name?.trim();
    if (!name || suggestions.has(name.toLowerCase())) {
      continue;
    }

    suggestions.set(name.toLowerCase(), {
      name,
      phone: player.phone?.trim() || undefined
    });
  }

  return Array.from(suggestions.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getPublicDataFromSupabase() {
  const supabase = createPublicSupabaseClient();
  if (!supabase) {
    throw new Error(missingDatabaseMessage);
  }

  const [matches, list, paymentSettings] = await Promise.all([
    supabase.from("matches").select("*").eq("status", "open").order("date", { ascending: true }).limit(1),
    supabase.from("public_match_registrations").select("*").order("position", { ascending: true }),
    supabase.from("payment_settings").select("*").eq("id", "default").maybeSingle<PaymentSettings>()
  ]);

  if (matches.error || list.error) {
    throw new Error(matches.error?.message || list.error?.message || "No se pudieron cargar los datos.");
  }

  const registrations = ((list.data ?? []) as PublicRegistrationRow[]).map((row) => ({
    id: row.id,
    match_id: row.match_id,
    player_id: row.id,
    position: row.position,
    status: row.status,
    payment_status: row.payment_status ?? "pending",
    accepted_terms: true,
    created_at: row.created_at
  }));
  const players = ((list.data ?? []) as PublicRegistrationRow[]).map((row) => ({
    id: row.id,
    name: row.player_name,
    phone: null,
    created_at: row.created_at
  }));

  const currentMatches = (matches.data ?? []) as Match[];

  return {
    matches: currentMatches,
    players,
    registrations,
    cancellations: [],
    payments: ((list.data ?? []) as PublicRegistrationRow[]).map((row) => ({
      id: `public-payment-${row.id}`,
      match_id: row.match_id,
      player_id: row.id,
      amount: 0,
      status: row.payment_status === "paid" ? "paid" : "pending",
      reason: null,
      created_at: row.created_at
    })),
    attendance: [],
    paymentSettings: paymentSettings.error ? paymentSettingsFromMatch(currentMatches[0]) : paymentSettings.data ?? paymentSettingsFromMatch(currentMatches[0])
  } satisfies AppData;
}

export async function reportPaymentInSupabase(input: {
  name: string;
  method: string;
  amount: number;
  reference?: string;
  comment?: string;
}) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    throw new Error(missingDatabaseMessage);
  }

  const name = normalizeName(input.name);
  if (name.length < 3) {
    throw new Error("Escribe tu nombre completo.");
  }

  if (!input.method.trim()) {
    throw new Error("Indica el método de pago.");
  }

  if (!input.amount || input.amount <= 0) {
    throw new Error("Indica el valor pagado.");
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "open")
    .order("date", { ascending: true })
    .limit(1)
    .single<Match>();

  if (matchError || !match) {
    throw new Error("No hay partido abierto para reportar pago.");
  }

  const { data: registrations, error: registrationError } = await supabase
    .from("registrations")
    .select("id, match_id, player_id, status, players(name)")
    .eq("match_id", match.id)
    .neq("status", "cancelled")
    .limit(200);

  if (registrationError) {
    throw new Error(registrationError.message);
  }

  const registration = (registrations ?? []).find((item) => {
    const player = Array.isArray(item.players) ? item.players[0] : item.players;
    return player?.name?.trim().toLowerCase() === name.toLowerCase();
  });

  let playerId = registration?.player_id;

  if (!playerId) {
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("*")
      .ilike("name", name)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<Player>();

    if (playerError) {
      throw new Error(playerError.message);
    }

    playerId = player?.id;
  }

  if (!playerId) {
    throw new Error("No encontramos una inscripción activa con ese nombre.");
  }

  const { error } = await supabase
    .from("payments")
    .upsert(
      {
        match_id: match.id,
        player_id: playerId,
        amount: match.price_per_player,
        status: "pending_review",
        method: input.method.trim(),
        reference: input.reference?.trim() || null,
        comment: input.comment?.trim() || null,
        reported_amount: input.amount,
        reported_at: new Date().toISOString(),
        reason: "Pago reportado por jugador"
      },
      { onConflict: "match_id,player_id" }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function getAdminDataFromSupabase() {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    throw new Error(missingDatabaseMessage);
  }

  const [matches, players, registrations, cancellations, payments, attendance, paymentSettings] = await Promise.all([
    supabase.from("matches").select("*").order("date", { ascending: true }),
    supabase.from("players").select("*").order("created_at", { ascending: true }),
    supabase.from("registrations").select("*").order("position", { ascending: true }),
    supabase.from("cancellations").select("*").order("created_at", { ascending: false }),
    supabase.from("payments").select("*").order("created_at", { ascending: false }),
    supabase.from("attendance").select("*").order("created_at", { ascending: false }),
    supabase.from("payment_settings").select("*").eq("id", "default").maybeSingle<PaymentSettings>()
  ]);

  const error = [matches, players, registrations, cancellations, payments, attendance].find((result) => result.error)?.error;
  if (error) {
    throw new Error(error.message);
  }

  const currentMatches = (matches.data ?? []) as Match[];

  return {
    matches: currentMatches,
    players: (players.data ?? []) as Player[],
    registrations: (registrations.data ?? []) as Registration[],
    cancellations: (cancellations.data ?? []) as Cancellation[],
    payments: (payments.data ?? []) as Payment[],
    attendance: (attendance.data ?? []) as Attendance[],
    paymentSettings: paymentSettings.error ? paymentSettingsFromMatch(currentMatches[0]) : paymentSettings.data ?? paymentSettingsFromMatch(currentMatches[0])
  } satisfies AppData;
}

export async function createRegistrationInSupabase(input: {
  name: string;
  phone?: string;
  acceptedTerms: boolean;
}) {
  if (!input.acceptedTerms) {
    throw new Error("Debes aceptar la regla de cancelación para anotarte.");
  }

  const supabase = createPublicSupabaseClient();
  if (!supabase) {
    throw new Error(missingDatabaseMessage);
  }

  const name = normalizeName(input.name);
  if (name.length < 3) {
    throw new Error("Escribe tu nombre completo.");
  }

  const { data, error } = await supabase.rpc("public_create_registration", {
    p_player_name: name,
    p_player_phone: input.phone?.trim() || null
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as RegistrationRpcRow;
  return {
    status: row.result_status,
    registration: {
      id: row.registration_id,
      match_id: row.result_match_id,
      player_id: row.registration_id,
      position: row.result_position,
      status: row.result_status,
      accepted_terms: true,
      created_at: new Date().toISOString(),
      player: { id: row.registration_id as string, name, phone: null, created_at: new Date().toISOString() }
    }
  };
}

export async function createCancellationInSupabase(input: {
  name: string;
  actionType: CancellationAction;
  declaredStatus: DeclaredStatus;
  hasReplacement: boolean;
  replacementName?: string;
  note?: string;
}) {
  const publicClient = createPublicSupabaseClient();
  if (!publicClient) {
    throw new Error(missingDatabaseMessage);
  }

  const name = normalizeName(input.name);
  if (name.length < 3) {
    throw new Error("Escribe tu nombre completo.");
  }

  const { data, error } = await publicClient.rpc("public_create_cancellation", {
    p_player_name: name,
    p_action_type: input.actionType,
    p_declared_status: input.declaredStatus,
    p_has_replacement: input.hasReplacement,
    p_replacement_name: input.replacementName?.trim() || null,
    p_note: input.note?.trim() || null
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as CancellationRpcRow;

  return {
    possibleDebt: row.possible_debt,
    previousStatus: row.previous_status,
    promotedPlayerId: row.promoted_player_id
  };
}

export async function updateMatchInSupabase(input: {
  id?: string;
  date: string;
  time: string;
  location: string;
  price_per_player: number;
  active_capacity: 12 | 18 | 20;
  status: MatchStatus;
}) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    throw new Error(missingDatabaseMessage);
  }

  const { data: match, error } = await supabase.from("matches").upsert(input).select("*").single<Match>();
  if (error) {
    throw new Error(error.message);
  }

  await recalculateMatchRegistrationsInSupabase(match.id);
}

export async function updatePaymentSettingsInSupabase(input: Omit<PaymentSettings, "id" | "updated_at">) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    throw new Error(missingDatabaseMessage);
  }

  const payload = {
    id: "default",
    responsible_name: input.responsible_name?.trim() || null,
    payment_key: input.payment_key?.trim() || null,
    payment_key_type: input.payment_key_type?.trim() || null,
    payment_deadline: input.payment_deadline?.trim() || null,
    payment_note: input.payment_note?.trim() || null,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from("payment_settings").upsert(payload, { onConflict: "id" });
  if (error) {
    throw new Error(error.message);
  }
}

export async function updateRegistrationStatusInSupabase(registrationId: string, status: RegistrationStatus) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error(missingDatabaseMessage);
  const { data: registration, error } = await supabase
    .from("registrations")
    .update({ status })
    .eq("id", registrationId)
    .select("match_id")
    .single<Pick<Registration, "match_id">>();
  if (error) throw new Error(error.message);
  await recalculateMatchRegistrationsInSupabase(registration.match_id);
}

export async function updateCancellationDecisionInSupabase(cancellationId: string, decision: AdminDecision) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error(missingDatabaseMessage);
  const { error } = await supabase.from("cancellations").update({ admin_decision: decision }).eq("id", cancellationId);
  if (error) throw new Error(error.message);
}

export async function upsertAttendanceInSupabase(matchId: string, playerId: string, attended: boolean) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error(missingDatabaseMessage);
  const { error } = await supabase
    .from("attendance")
    .upsert({ match_id: matchId, player_id: playerId, attended }, { onConflict: "match_id,player_id" });
  if (error) throw new Error(error.message);
}

export async function upsertPaymentInSupabase(matchId: string, playerId: string, amount: number, status: PaymentStatus) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error(missingDatabaseMessage);
  const reasonByStatus: Record<PaymentStatus, string> = {
    pending: "Pendiente de pago",
    pending_review: "Pago reportado pendiente de revisión",
    paid: "Pago verificado por admin",
    rejected: "Reporte rechazado por admin",
    debt: "Deuda registrada por admin",
    waived: "Deuda exonerada por admin"
  };
  const { error } = await supabase
    .from("payments")
    .upsert(
      {
        match_id: matchId,
        player_id: playerId,
        amount,
        status,
        reason: reasonByStatus[status]
      },
      { onConflict: "match_id,player_id" }
    );
  if (error) throw new Error(error.message);
}

async function recalculateMatchRegistrationsInSupabase(matchId: string) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error(missingDatabaseMessage);
  const { error } = await supabase.rpc("recalculate_match_registrations", { p_match_id: matchId });
  if (error) throw new Error(error.message);
}
