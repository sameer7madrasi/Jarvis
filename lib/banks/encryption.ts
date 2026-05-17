/**
 * AES-256-GCM encryption helpers for at-rest secrets (currently used to
 * wrap Plaid access_tokens before storing them in `linked_items`).
 *
 * Why GCM:
 *   - Authenticated encryption — tamper detection comes for free.
 *   - Native to Node's `crypto` module, no external deps.
 *
 * Key handling:
 *   - The encryption key is read from `JARVIS_ENCRYPTION_KEY` (32-byte hex,
 *     i.e. 64 hex characters). Generate once with:
 *       node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   - If the env var is missing, calls throw on first use. Tokens are too
 *     sensitive to silently fall back to plaintext.
 *
 * Serialization format (single base64 string, easy to store as text):
 *   base64( IV(12 bytes) || AUTH_TAG(16 bytes) || CIPHERTEXT )
 *
 * Caveat: if you rotate `JARVIS_ENCRYPTION_KEY` you must re-encrypt every
 * stored token. There is no built-in key rotation flow yet — TODO when we
 * grow past one user.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

function getKey(): Buffer {
  const hex = process.env.JARVIS_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "JARVIS_ENCRYPTION_KEY is not set. Generate with: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `JARVIS_ENCRYPTION_KEY must be ${KEY_BYTES} bytes (${KEY_BYTES * 2} hex chars); got ${key.length} bytes`,
    );
  }
  return key;
}

/**
 * Encrypt `plaintext` with AES-256-GCM. Returns a single base64 string
 * containing IV || AUTH_TAG || CIPHERTEXT, safe to store in a `text`
 * column.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/**
 * Inverse of `encrypt`. Throws if the ciphertext was tampered with or if
 * the encryption key has changed since it was written.
 */
export function decrypt(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error("Encrypted payload is truncated or malformed");
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** True if `JARVIS_ENCRYPTION_KEY` is set to a usable 32-byte value. */
export function isEncryptionConfigured(): boolean {
  const hex = process.env.JARVIS_ENCRYPTION_KEY;
  if (!hex) return false;
  try {
    return Buffer.from(hex, "hex").length === KEY_BYTES;
  } catch {
    return false;
  }
}
