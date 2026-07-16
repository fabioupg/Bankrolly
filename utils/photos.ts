// Photo storage for live-session notes.
//
// expo-image-picker returns URIs inside a cache directory that iOS is free to
// purge, which would leave saved notes with broken images. We copy each picked
// photo into the app's document directory and store that stable URI instead.

import * as FileSystem from 'expo-file-system/legacy';

/** Where note photos live. Backup/restore writes here too, so it is shared. */
export const PHOTO_DIR = `${FileSystem.documentDirectory}live-notes/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

/** Copy a picked photo into permanent storage; returns the stable file URI. */
export async function persistNotePhoto(sourceUri: string): Promise<string> {
  if (!FileSystem.documentDirectory) throw new Error('No writable directory available');
  await ensureDir();
  const ext = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const target = `${PHOTO_DIR}${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: target });
  return target;
}

/** Best-effort delete of a note photo; a missing file is not an error. */
export async function deleteNotePhoto(uri: string): Promise<void> {
  if (!uri || !uri.startsWith(PHOTO_DIR)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}
