import { NextResponse } from "next/server";
import { getPublicDataFromSupabase } from "@/lib/server/data";

export async function GET() {
  try {
    return NextResponse.json({ data: await getPublicDataFromSupabase() });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudieron cargar los datos." },
      { status: 503 }
    );
  }
}
