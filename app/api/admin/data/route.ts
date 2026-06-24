import { NextResponse } from "next/server";
import { isAdminSessionValid } from "@/lib/server/admin-auth";
import { getAdminDataFromSupabase } from "@/lib/server/data";

export async function GET() {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    return NextResponse.json({ data: await getAdminDataFromSupabase() });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "No se pudieron cargar los datos." },
      { status: 503 }
    );
  }
}
