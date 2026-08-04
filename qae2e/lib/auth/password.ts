// Password hashing via Node's scrypt (no external deps).
// Format: scrypt$N$r$p$salt$hash  — self-describing so params can evolve.

import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN, { N, r, p }).toString("hex");
  return `scrypt$${N}$${r}$${p}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, n, rr, pp, salt, hash] = stored.split("$");
    if (algo !== "scrypt") return false;
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(rr),
      p: Number(pp),
    });
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
