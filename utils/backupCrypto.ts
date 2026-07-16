// Encryption for the .bankrolly backup container.
//
// READ THIS BEFORE TRUSTING IT WITH ANYTHING.
//
// The key is derived from a secret baked into the app bundle, because a restore
// has to work on a brand-new phone with nothing but the file — there is no
// password and nothing for the user to remember. So anyone who can pull the
// secret out of the IPA can decrypt any backup file. That is not a flaw in the
// implementation, it is inherent: the app must be able to read the file,
// therefore the app carries everything needed to read the file.
//
// What this buys: a competitor cannot write an importer for our format by
// opening it in a text editor; they have to reverse-engineer the binary first.
// It is a speed bump, not a lock.
//
// What it does NOT buy: protection of the user's data. Never describe a backup
// as "securely encrypted" in user-facing copy, and never put anything in the
// container that would be harmful to leak.
//
// The AEAD tag is the part that carries real weight — it makes a truncated,
// corrupted or hand-edited file fail loudly on import instead of restoring
// half-garbage into the user's database.

import * as Crypto from 'expo-crypto';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';

/** "BRLY" — the first 4 bytes of every backup file. */
export const MAGIC = Uint8Array.from([0x42, 0x52, 0x4c, 0x59]);
export const FORMAT_VERSION = 1;
export const SALT_BYTES = 16;
export const HEADER_BYTES = MAGIC.length + 1 + SALT_BYTES;
export const LENGTH_BYTES = 4;
const NONCE_BYTES = 24;

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// Obfuscation secret — see the warning at the top of this file. Changing it
// makes every previously exported backup unreadable, so it travels with the
// format version rather than being rotated.
const APP_SECRET = hexToBytes(
  'e5797674852e4f576809b45bee255fbf5ebf581cb02ab776c8a1ea79442ffeb7',
);

export class BackupFormatError extends Error {}

export function randomSalt(): Uint8Array {
  return Crypto.getRandomBytes(SALT_BYTES);
}

/** Per-file key. The salt makes two exports of the same data look unrelated. */
export function deriveKey(salt: Uint8Array): Uint8Array {
  return hkdf(sha256, APP_SECRET, salt, 'bankrolly-backup-v1', 32);
}

/**
 * Binds a frame to its position in the file. Without it, frames could be
 * reordered, dropped or spliced in from another backup and every individual
 * tag would still verify.
 */
function aad(index: number): Uint8Array {
  const a = new Uint8Array(MAGIC.length + 1 + 4);
  a.set(MAGIC, 0);
  a[MAGIC.length] = FORMAT_VERSION;
  new DataView(a.buffer).setUint32(MAGIC.length + 1, index, false);
  return a;
}

/** magic ‖ version ‖ salt — the plaintext preamble every file starts with. */
export function buildHeader(salt: Uint8Array): Uint8Array {
  const h = new Uint8Array(HEADER_BYTES);
  h.set(MAGIC, 0);
  h[MAGIC.length] = FORMAT_VERSION;
  h.set(salt, MAGIC.length + 1);
  return h;
}

/** Validate the preamble and return the file's salt. */
export function readHeader(bytes: Uint8Array): Uint8Array {
  if (bytes.length < HEADER_BYTES) throw new BackupFormatError('This file is not a Bankrolly backup.');
  if (!MAGIC.every((b, i) => bytes[i] === b)) {
    throw new BackupFormatError('This file is not a Bankrolly backup.');
  }
  const version = bytes[MAGIC.length];
  if (version !== FORMAT_VERSION) {
    throw new BackupFormatError(
      `This backup was written by a newer version of Bankrolly (format ${version}). Update the app and try again.`,
    );
  }
  return bytes.slice(MAGIC.length + 1, HEADER_BYTES);
}

/** length(4) ‖ nonce(24) ‖ ciphertext — one self-contained frame. */
export function sealFrame(key: Uint8Array, index: number, plaintext: Uint8Array): Uint8Array {
  const nonce = Crypto.getRandomBytes(NONCE_BYTES);
  const ct = xchacha20poly1305(key, nonce, aad(index)).encrypt(plaintext);
  const frame = new Uint8Array(LENGTH_BYTES + NONCE_BYTES + ct.length);
  new DataView(frame.buffer).setUint32(0, NONCE_BYTES + ct.length, false);
  frame.set(nonce, LENGTH_BYTES);
  frame.set(ct, LENGTH_BYTES + NONCE_BYTES);
  return frame;
}

/** Decrypt a frame body (nonce ‖ ciphertext) — a frame minus its length prefix. */
export function openFrame(key: Uint8Array, index: number, body: Uint8Array): Uint8Array {
  if (body.length <= NONCE_BYTES) throw new BackupFormatError('Backup file is truncated.');
  try {
    return xchacha20poly1305(key, body.subarray(0, NONCE_BYTES), aad(index)).decrypt(
      body.subarray(NONCE_BYTES),
    );
  } catch {
    // Wrong key, frames out of order, or the bytes were altered.
    throw new BackupFormatError('Backup file is damaged and cannot be restored.');
  }
}

/** Read a frame's 4-byte length prefix. */
export function frameLength(prefix: Uint8Array): number {
  if (prefix.length < LENGTH_BYTES) throw new BackupFormatError('Backup file is truncated.');
  return new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength).getUint32(0, false);
}
