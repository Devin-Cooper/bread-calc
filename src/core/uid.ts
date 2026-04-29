// Stable per-RecipeItem identifier: 10-character URL-safe slug drawn from a
// 60-bit (10 × 6 bits) keyspace. Generated client-side; no central registry.
// Survives item-array mutations so Fix payloads can reference items unambiguously.

export const UID_REGEX = /^[A-Za-z0-9_-]{8,16}$/;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

export function generateUid(): string {
  // crypto.getRandomValues gives uniform random bytes; we map every 6 bits to
  // one ALPHABET char (alphabet length is exactly 64 so the mapping is unbiased).
  // 10 chars × 6 bits = 60 bits of entropy.
  const bytes = new Uint8Array(10);
  // globalThis.crypto exists in Node ≥19 and all modern browsers.
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += ALPHABET[bytes[i]! & 0x3f]!;
  }
  return out;
}

export function isValidUid(value: unknown): value is string {
  return typeof value === "string" && UID_REGEX.test(value);
}
