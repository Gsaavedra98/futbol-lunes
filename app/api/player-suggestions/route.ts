import { NextResponse } from "next/server";
import { getPlayerSuggestionsFromSupabase } from "@/lib/server/data";

export async function GET() {
  try {
    return NextResponse.json({ players: await getPlayerSuggestionsFromSupabase() });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudieron cargar las sugerencias." },
      { status: 503 }
    );
  }
}
