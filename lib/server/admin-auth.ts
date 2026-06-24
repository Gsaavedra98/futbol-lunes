import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "futbol_lunes_admin";

function adminPassword() {
  return process.env.ADMIN_PASSWORD || "admin123";
}

function adminToken() {
  return createHmac("sha256", adminPassword()).update("futbol-lunes-admin").digest("hex");
}

export async function setAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, adminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function isAdminSessionValid() {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) {
    return false;
  }

  const expected = adminToken();
  try {
    return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function isAdminPasswordValid(password?: string) {
  if (!password) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(password), Buffer.from(adminPassword()));
  } catch {
    return false;
  }
}
