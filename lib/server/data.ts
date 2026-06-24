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
  PaymentStatus,
  Player,
  Registration,
  RegistrationStatus
} from "@/lib/types";
import { isSameMonday, normalizeName, statusForPosition } from "@/lib/utils";
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
  created_at: string;
  player_name: string;
};

export async function getPublicDataFromSupabase() {
  const supabase = createPublicSupabaseClient();
  if (!supabase) {
    throw new Error(missingDatabaseMessage);
  }

  const [matches, list] = await Promise.all([
    supabase.from("matches").select("*").eq("status", "open").order("date", { ascending: true }).limit(1),
    supabase.from("public_match_registrations").select("*").order("position", { ascending: true })
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
    accepted_terms: true,
    created_at: row.created_at
  }));
  const players = ((list.data ?? []) as PublicRegistrationRow[]).map((row) => ({
    id: row.id,
    name: row.player_name,
    phone: null,
    created_at: row.created_at
  }));

  return {
    matches: (matches.data ?? []) as Match[],
    players,
    registrations,
    cancellations: [],
    payments: [],
    attendance: []
  } satisfies AppData;
}

export async function getAdminDataFromSupabase() {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    throw new Error(missingDatabaseMessage);
  }

  const [matches, players, registrations, cancellations, payments, attendance] = await Promise.all([
    supabase.from("matches").select("*").order("date", { ascending: true }),
    supabase.from("players").select("*").order("created_at", { ascending: true }),
    supabase.from("registrations").select("*").order("position", { ascending: true }),
    supabase.from("cancellations").select("*").order("created_at", { ascending: false }),
    supabase.from("payments").select("*").order("created_at", { ascending: false }),
    supabase.from("attendance").select("*").order("created_at", { ascending: false })
  ]);

  const error = [matches, players, registrations, cancellations, payments, attendance].find((result) => result.error)?.error;
  if (error) {
    throw new Error(error.message);
  }

  return {
    matches: (matches.data ?? []) as Match[],
    players: (players.data ?? []) as Player[],
    registrations: (registrations.data ?? []) as Registration[],
    cancellations: (cancellations.data ?? []) as Cancellation[],
    payments: (payments.data ?? []) as Payment[],
    attendance: (attendance.data ?? []) as Attendance[]
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

  const row = Array.isArray(data) ? data[0] : data;
  return {
    status: row.result_status as RegistrationStatus,
    registration: {
      id: row.registration_id as string,
      match_id: row.result_match_id as string,
      player_id: row.registration_id as string,
      position: row.result_position as number,
      status: row.result_status as RegistrationStatus,
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
  const adminClient = createAdminSupabaseClient();
  if (!publicClient || !adminClient) {
    throw new Error(missingDatabaseMessage);
  }

  const name = normalizeName(input.name);
  if (name.length < 3) {
    throw new Error("Escribe tu nombre completo.");
  }

  const { data: cancellationId, error } = await publicClient.rpc("public_create_cancellation", {
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

  const { data: cancellation } = await adminClient
    .from("cancellations")
    .select("*")
    .eq("id", cancellationId)
    .single<Cancellation>();
  const { data: match } = await adminClient
    .from("matches")
    .select("*")
    .eq("id", cancellation?.match_id)
    .single<Match>();
  const { data: registration } = await adminClient
    .from("registrations")
    .select("*")
    .eq("match_id", cancellation?.match_id)
    .eq("player_id", cancellation?.player_id)
    .neq("status", "cancelled")
    .maybeSingle<Registration>();

  const possibleDebt =
    Boolean(match && cancellation && registration?.status === "confirmed") &&
    isSameMonday(match!.date, cancellation!.created_at) &&
    !cancellation!.has_replacement;

  if (possibleDebt && match && cancellation) {
    await adminClient
      .from("payments")
      .upsert(
        {
          match_id: match.id,
          player_id: cancellation.player_id,
          amount: match.price_per_player,
          status: "pending",
          reason: "Cancelación el mismo lunes sin reemplazo confirmado"
        },
        { onConflict: "match_id,player_id" }
      );
  }

  if (registration) {
    await adminClient.from("registrations").update({ status: "cancelled" }).eq("id", registration.id);
  }

  return { possibleDebt };
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

  const { data: registrations } = await supabase
    .from("registrations")
    .select("*")
    .eq("match_id", match.id)
    .not("status", "in", "(cancelled,replacement)");

  await Promise.all(
    ((registrations ?? []) as Registration[]).map((registration) =>
      supabase
        .from("registrations")
        .update({ status: statusForPosition(registration.position, match.active_capacity) })
        .eq("id", registration.id)
    )
  );
}

export async function updateRegistrationStatusInSupabase(registrationId: string, status: RegistrationStatus) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) throw new Error(missingDatabaseMessage);
  const { error } = await supabase.from("registrations").update({ status }).eq("id", registrationId);
  if (error) throw new Error(error.message);
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
  const { error } = await supabase
    .from("payments")
    .upsert(
      {
        match_id: matchId,
        player_id: playerId,
        amount,
        status,
        reason: status === "paid" ? "Pago registrado por admin" : status === "waived" ? "Deuda exonerada por admin" : "Pendiente de pago"
      },
      { onConflict: "match_id,player_id" }
    );
  if (error) throw new Error(error.message);
}
