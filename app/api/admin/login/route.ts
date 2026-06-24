import { NextResponse } from "next/server";
import { isAdminPasswordValid, setAdminSession } from "@/lib/server/admin-auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };

  if (isAdminPasswordValid(body.password)) {
    await setAdminSession();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, message: "Clave incorrecta" }, { status: 401 });
}
