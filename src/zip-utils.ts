import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export type ZipEntries = Record<string, Uint8Array>;

export function unzipArrayBuffer(arrayBuffer: ArrayBuffer): ZipEntries {
  return unzipSync(new Uint8Array(arrayBuffer));
}

export function zipText(entries: ZipEntries, path: string): string | null {
  const bytes = entries[path];
  return bytes ? strFromU8(bytes) : null;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function zipBase64(entries: ZipEntries, path: string): string | null {
  const bytes = entries[path];
  return bytes ? bytesToBase64(bytes) : null;
}

export function createZipBlob(files: Record<string, string | Uint8Array>, type: string): Blob {
  const entries: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(files)) {
    entries[path] = typeof content === 'string' ? strToU8(content) : content;
  }
  const zipped = zipSync(entries);
  const copy = new Uint8Array(zipped.length);
  copy.set(zipped);
  return new Blob([copy.buffer], { type });
}
