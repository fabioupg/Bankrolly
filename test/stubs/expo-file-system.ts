export const cacheDirectory = '/tmp/';
export const documentDirectory = '/tmp/';
export const EncodingType = { UTF8: 'utf8', Base64: 'base64' } as const;

export async function writeAsStringAsync(): Promise<void> {}
export async function readAsStringAsync(): Promise<string> {
  return '';
}
export async function deleteAsync(): Promise<void> {}
export async function getInfoAsync(): Promise<{ exists: boolean }> {
  return { exists: false };
}
