"use client";

const MEMORY_KEY = "futbol-lunes-player-memory";

export type RememberedPlayer = {
  name: string;
  phone?: string;
};

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function getRememberedPlayers(): RememberedPlayer[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(MEMORY_KEY);
    return stored ? (JSON.parse(stored) as RememberedPlayer[]) : [];
  } catch {
    return [];
  }
}

export function rememberPlayer(name: string, phone?: string) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeName(name);
  if (!normalized) {
    return;
  }

  const nextPlayer = { name: normalized, phone: phone?.trim() || undefined };
  const previous = getRememberedPlayers().filter(
    (player) => player.name.toLowerCase() !== normalized.toLowerCase()
  );
  window.localStorage.setItem(MEMORY_KEY, JSON.stringify([nextPlayer, ...previous].slice(0, 12)));
}

export function phoneForRememberedPlayer(name: string) {
  const normalized = normalizeName(name).toLowerCase();
  return getRememberedPlayers().find((player) => player.name.toLowerCase() === normalized)?.phone;
}

export async function getPlayerSuggestions() {
  const localPlayers = getRememberedPlayers();

  try {
    const response = await fetch("/api/player-suggestions", { cache: "no-store" });
    if (!response.ok) {
      return localPlayers;
    }

    const payload = (await response.json()) as { players?: RememberedPlayer[] };
    const merged = new Map<string, RememberedPlayer>();

    for (const player of [...(payload.players ?? []), ...localPlayers]) {
      const normalized = normalizeName(player.name);
      if (!normalized) continue;
      merged.set(normalized.toLowerCase(), {
        name: normalized,
        phone: player.phone?.trim() || undefined
      });
    }

    return Array.from(merged.values());
  } catch {
    return localPlayers;
  }
}

export function phoneForPlayerSuggestion(name: string, players: RememberedPlayer[]) {
  const normalized = normalizeName(name).toLowerCase();
  return players.find((player) => player.name.toLowerCase() === normalized)?.phone;
}
