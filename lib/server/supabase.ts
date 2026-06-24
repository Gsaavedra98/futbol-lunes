import { createClient } from "@supabase/supabase-js";

export const missingDatabaseMessage = "La base de datos no está configurada";

function publicSupabaseKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

export function hasPublicSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && publicSupabaseKey());
}

export function hasAdminSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createPublicSupabaseClient() {
  if (!hasPublicSupabaseConfig()) {
    return null;
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    publicSupabaseKey() as string,
    {
      auth: { persistSession: false }
    }
  );
}

export function createAdminSupabaseClient() {
  if (!hasAdminSupabaseConfig()) {
    return null;
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    {
      auth: { persistSession: false, autoRefreshToken: false }
    }
  );
}
