import { loadEntries, SCHEMA_VERSION, type EntriesResult, type VaultEntry } from './schema';

const APP = 'lycee-tracker';

/**
 * Exported file. Its shape is the contract between app versions: `schemaVersion` tells
 * `loadEntries` which migrations to run when the file is imported later.
 * Version 1 files have `profiles` (plain); version 2+ have `entries` (encrypted vault entries).
 */
export interface BackupFile {
  app: typeof APP;
  schemaVersion: number;
  exportedAt: string;
  entries: VaultEntry[];
}

export function toBackup(entries: VaultEntry[]): BackupFile {
  return { app: APP, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), entries };
}

/** Parses an exported file of any past version; throws a French message when it cannot be used. */
export function parseBackup(text: string): EntriesResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Le fichier n’est pas un JSON valide.');
  }
  if (typeof data !== 'object' || data === null || (data as { app?: unknown }).app !== APP)
    throw new Error('Ce fichier n’est pas une sauvegarde Lycée Tracker.');
  const { schemaVersion, profiles, entries } = data as { schemaVersion?: unknown; profiles?: unknown; entries?: unknown };
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1)
    throw new Error('La version de la sauvegarde est illisible.');
  if (schemaVersion > SCHEMA_VERSION)
    throw new Error('Cette sauvegarde provient d’une version plus récente de l’application. Recharge la page.');
  return loadEntries(schemaVersion < 2 ? profiles : entries, schemaVersion);
}

export function downloadBackup(entries: VaultEntry[]): void {
  const blob = new Blob([JSON.stringify(toBackup(entries), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lycee-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
