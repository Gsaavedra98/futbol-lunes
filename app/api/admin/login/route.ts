import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };
  const expected = process.env.ADMIN_PASSWORD || "admin123";

  if (body.password && body.password === expected) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, message: "Clave incorrecta" }, { status: 401 });
}
