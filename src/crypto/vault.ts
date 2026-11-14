/**
 * Password-based encryption of a profile, entirely in the browser (Web Crypto API).
 *
 * - Key: PBKDF2-SHA256 over the password with a random 16-byte salt per profile
 *   (600 000 iterations, OWASP 2023 recommendation), giving a non-extractable AES-GCM 256 key.
 * - Data: AES-GCM with a fresh random 12-byte IV for every save; GCM authenticates the data,
 *   so a wrong password or a tampered file fails to decrypt instead of returning garbage.
 * - The password and the key never leave memory; nothing allows recovering a forgotten password.
 */

export const KDF_ITERATIONS = 600_000;
export const MIN_PASSWORD_LENGTH = 8;

/** Mutable only so that tests can use fewer iterations. */
export const kdfConfig = { iterations: KDF_ITERATIONS };

export interface SealedBox {
  v: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  /** Base64. */
  salt: string;
  /** Base64. */
  iv: string;
  /** Base64, AES-GCM output including the authentication tag. */
  data: string;
}

/** Key of an unlocked profile, kept in memory only. */
export interface UnlockedKey {
  key: CryptoKey;
  salt: string;
  iterations: number;
}

export class WrongPasswordError extends Error {
  constructor() {
    super('Mot de passe incorrect.');
  }
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** New key for a new password (new salt). */
export async function createKey(password: string): Promise<UnlockedKey> {
  const salt = random(16);
  const iterations = kdfConfig.iterations;
  return { key: await deriveKey(password, salt, iterations), salt: toBase64(salt), iterations };
}

export async function seal(value: unknown, k: UnlockedKey): Promise<SealedBox> {
  const iv = random(12);
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k.key, plain));
  return { v: 1, kdf: 'PBKDF2-SHA256', iterations: k.iterations, salt: k.salt, iv: toBase64(iv), data: toBase64(data) };
}

async function decrypt(box: SealedBox, key: CryptoKey): Promise<unknown> {
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(box.iv) }, key, fromBase64(box.data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new WrongPasswordError();
  }
}

/** Decrypts with a password; returns the content and the key to keep re-encrypting with. */
export async function open(box: SealedBox, password: string): Promise<{ value: unknown; key: UnlockedKey }> {
  const key: UnlockedKey = {
    key: await deriveKey(password, fromBase64(box.salt), box.iterations),
    salt: box.salt,
    iterations: box.iterations,
  };
  return { value: await decrypt(box, key.key), key };
}

export function isSealedBox(v: unknown): v is SealedBox {
  if (typeof v !== 'object' || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    b.v === 1 &&
    b.kdf === 'PBKDF2-SHA256' &&
    typeof b.iterations === 'number' &&
    b.iterations >= 1 &&
    b.iterations <= 10_000_000 &&
    ['salt', 'iv', 'data'].every((k) => typeof b[k] === 'string' && /^[A-Za-z0-9+/=]*$/.test(b[k] as string))
  );
}

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH)
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  return null;
}
