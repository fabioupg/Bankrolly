import { describe, expect, it } from 'vitest';
import {
  BackupFormatError,
  FORMAT_VERSION,
  HEADER_BYTES,
  LENGTH_BYTES,
  SALT_BYTES,
  buildHeader,
  deriveKey,
  frameLength,
  openFrame,
  randomSalt,
  readHeader,
  sealFrame,
} from '@/utils/backupCrypto';

const text = (s: string) => new TextEncoder().encode(s);

describe('header', () => {
  it('round-trips the salt through build/read', () => {
    const salt = randomSalt();
    expect(salt.length).toBe(SALT_BYTES);
    const header = buildHeader(salt);
    expect(header.length).toBe(HEADER_BYTES);
    expect(readHeader(header)).toEqual(salt);
  });

  it('rejects files that are not backups', () => {
    expect(() => readHeader(new Uint8Array(2))).toThrow(BackupFormatError);
    const wrongMagic = buildHeader(randomSalt());
    wrongMagic[0] = 0x00;
    expect(() => readHeader(wrongMagic)).toThrow('not a Bankrolly backup');
  });

  it('rejects newer format versions with an upgrade hint', () => {
    const future = buildHeader(randomSalt());
    future[4] = FORMAT_VERSION + 1;
    expect(() => readHeader(future)).toThrow('newer version');
  });
});

describe('key derivation', () => {
  it('is deterministic per salt and differs across salts', () => {
    const salt = randomSalt();
    expect(deriveKey(salt)).toEqual(deriveKey(salt));
    expect(deriveKey(salt)).not.toEqual(deriveKey(randomSalt()));
    expect(deriveKey(salt).length).toBe(32);
  });
});

describe('frames', () => {
  const key = deriveKey(randomSalt());
  const plaintext = text('{"cash":[],"tourneys":[]}');

  it('round-trips plaintext through seal/open', () => {
    const frame = sealFrame(key, 0, plaintext);
    expect(frameLength(frame)).toBe(frame.length - LENGTH_BYTES);
    const body = frame.subarray(LENGTH_BYTES);
    expect(openFrame(key, 0, body)).toEqual(plaintext);
  });

  it('binds a frame to its position — a reordered frame fails', () => {
    const frame = sealFrame(key, 0, plaintext);
    expect(() => openFrame(key, 1, frame.subarray(LENGTH_BYTES))).toThrow(BackupFormatError);
  });

  it('rejects tampered ciphertext and wrong keys', () => {
    const frame = sealFrame(key, 0, plaintext);
    const body = frame.slice(LENGTH_BYTES);
    body[body.length - 1] ^= 0xff;
    expect(() => openFrame(key, 0, body)).toThrow('damaged');

    const otherKey = deriveKey(randomSalt());
    expect(() => openFrame(otherKey, 0, frame.subarray(LENGTH_BYTES))).toThrow(BackupFormatError);
  });

  it('rejects truncated frames', () => {
    expect(() => openFrame(key, 0, new Uint8Array(10))).toThrow('truncated');
    expect(() => frameLength(new Uint8Array(2))).toThrow('truncated');
  });
});
