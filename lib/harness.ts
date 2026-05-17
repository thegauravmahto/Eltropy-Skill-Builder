// Harness client config — Gemini API key + backend URL.
// Key lives in localStorage only (never sent to Vercel). Backend URL comes from env.

export const API_KEY_STORAGE = "skill_builder.gemini_api_key";

export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(API_KEY_STORAGE);
}

export function setApiKey(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(API_KEY_STORAGE, key);
  window.dispatchEvent(new Event("skill_builder.api_key_changed"));
}

export function clearApiKey(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(API_KEY_STORAGE);
  window.dispatchEvent(new Event("skill_builder.api_key_changed"));
}

export function getHarnessUrl(): string | null {
  return process.env.NEXT_PUBLIC_HARNESS_URL?.trim() || null;
}

export function isHarnessLive(): boolean {
  return Boolean(getHarnessUrl());
}
