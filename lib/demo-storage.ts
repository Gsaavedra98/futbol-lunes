import { seedData } from "./seed";
import type { AppData } from "./types";

const STORE_KEY = "futbol-lunes-data";

export function canUseDemoStorage() {
  return process.env.NODE_ENV === "development" && typeof window !== "undefined";
}

export function loadDemoData(): AppData {
  if (!canUseDemoStorage()) {
    return seedData;
  }

  const stored = window.localStorage.getItem(STORE_KEY);
  if (!stored) {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(seedData));
    return seedData;
  }

  try {
    return JSON.parse(stored) as AppData;
  } catch {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(seedData));
    return seedData;
  }
}

export function saveDemoData(data: AppData) {
  if (canUseDemoStorage()) {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(data));
  }
}
