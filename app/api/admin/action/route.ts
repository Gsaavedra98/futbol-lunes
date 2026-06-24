import { NextResponse } from "next/server";
import { isAdminSessionValid } from "@/lib/server/admin-auth";
import {
  updateCancellationDecisionInSupabase,
  updateMatchInSupabase,
  updateRegistrationStatusInSupabase,
  upsertAttendanceInSupabase,
  upsertPaymentInSupabase
} from "@/lib/server/data";
import type { AdminDecision, MatchStatus, PaymentStatus, RegistrationStatus } from "@/lib/types";

export async function POST(request: Request) {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (body.action === "updateMatch") {
      await updateMatchInSupabase({
        id: body.match?.id,
        date: body.match?.date,
        time: body.match?.time,
        location: body.match?.location,
        price_per_player: Number(body.match?.price_per_player),
        active_capacity: Number(body.match?.active_capacity) as 12 | 18 | 20,
        status: body.match?.status as MatchStatus
      });
    }

    if (body.action === "updateRegistrationStatus") {
      await updateRegistrationStatusInSupabase(body.registrationId, body.status as RegistrationStatus);
    }

    if (body.action === "updateCancellationDecision") {
      await updateCancellationDecisionInSupabase(body.cancellationId, body.decision as AdminDecision);
    }

    if (body.action === "upsertAttendance") {
      await upsertAttendanceInSupabase(body.matchId, body.playerId, Boolean(body.attended));
    }

    if (body.action === "upsertPayment") {
      await upsertPaymentInSupabase(body.matchId, body.playerId, Number(body.amount), body.status as PaymentStatus);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo completar la operación." },
      { status: 400 }
    );
  }
}
