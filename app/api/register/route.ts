import { NextResponse } from "next/server";
import { createRegistrationInSupabase } from "@/lib/server/data";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      phone?: string;
      acceptedTerms?: boolean;
    };
    const result = await createRegistrationInSupabase({
      name: body.name ?? "",
      phone: body.phone,
      acceptedTerms: Boolean(body.acceptedTerms)
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudo guardar la inscripción." },
      { status: 400 }
    );
  }
}
