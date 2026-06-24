import { NextResponse } from "next/server";
import { createCancellationInSupabase } from "@/lib/server/data";
import type { CancellationAction, DeclaredStatus } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      actionType?: CancellationAction;
      declaredStatus?: DeclaredStatus;
      hasReplacement?: boolean;
      replacementName?: string;
      note?: string;
    };
    const result = await createCancellationInSupabase({
      name: body.name ?? "",
      actionType: body.actionType ?? "cancel",
      declaredStatus: body.declaredStatus ?? "unknown",
      hasReplacement: Boolean(body.hasReplacement),
      replacementName: body.replacementName,
      note: body.note
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo guardar la cancelación." },
      { status: 400 }
    );
  }
}
