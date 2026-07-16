import { randomFillSync } from 'node:crypto';

export function getRandomBytes(count: number): Uint8Array {
  const out = new Uint8Array(count);
  randomFillSync(out);
  return out;
}
