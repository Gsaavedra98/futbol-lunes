import { NextResponse } from "next/server";
import { reportPaymentInSupabase } from "@/lib/server/data";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      method?: string;
      amount?: number | string;
      reference?: string;
      comment?: string;
    };

    const amount =
      typeof body.amount === "number"
        ? body.amount
        : Number(String(body.amount ?? "").replace(/[^\d]/g, ""));

    await reportPaymentInSupabase({
      name: body.name ?? "",
      method: body.method ?? "",
      amount,
      reference: body.reference,
      comment: body.comment
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo reportar el pago." },
      { status: 400 }
    );
  }
}
