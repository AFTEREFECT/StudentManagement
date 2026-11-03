/// <reference types="vite/client" />

interface Window {
  desktopAttendance?: {
    archiveKey(): Promise<{ keyId: string; publicJwk: JsonWebKey }>;
    signArchive(payload: string): Promise<{ keyId: string; payload: string; signature: string }>;
    claim(key: string): Promise<{ claimed: boolean; token: string; phase: 'syncing' | 'success' | 'failed'; error: string }>;
    finish(key: string, token: string, result: { phase: 'success' | 'failed'; error: string }): Promise<void>;
  };
  desktopStorage?: {
    readDatabase(): Promise<Uint8Array | null>;
    writeDatabase(data: Uint8Array): Promise<void>;
    deleteDatabase(): Promise<void>;
  };
}
