import { commands } from 'vitest/browser';

declare module 'vitest/browser' {
  interface BrowserCommands {
    listSamples(limit?: number): Promise<string[]>;
    readSample(path: string): Promise<string>;
    writeSample(name: string, text: string): Promise<void>;
  }
}

/** Paths of local sample photos (HEROPICK_SAMPLES), spread evenly across the shoot. Empty when not set. */
export const listSamples = (limit?: number) => commands.listSamples(limit);

/** One local sample photo as a File (read by Node, so cloud-synced folders work). */
export async function sampleFile(path: string): Promise<File> {
  const b64 = await commands.readSample(path);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const name = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
  return new File([bytes], name, { type: 'image/jpeg', lastModified: 0 });
}

export const writeSample = (name: string, text: string) => commands.writeSample(name, text);
