import crypto from "crypto";

/**
 * Secrets encryption for Vercel (no KMS). AES-256-GCM with a key derived
 * from the JWT_SECRET env var. Ciphertext format: version:iv:tag:data (base64).
 *
 * Production note: use a dedicated secret as the encryption key (separate
 * from the JWT signing secret). For this platform, JWT_SECRET doubles as the
 * envelope key so both apps stay in sync.
 */
const VERSION = "v1";

function key(): Buffer {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret-change-me";
  // 32 bytes for AES-256
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

export function decryptSecret(ciphertext: string): string {
  const [version, ivB64, tagB64, dataB64] = ciphertext.split(":");
  if (version !== VERSION) throw new Error("Unknown ciphertext version");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
