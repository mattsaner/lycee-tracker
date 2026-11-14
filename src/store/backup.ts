import type { Profile } from '../domain/types';
import { SCHEMA_VERSION } from './store';

const APP = 'lycee-tracker';

export interface BackupFile {
  app: typeof APP;
  schemaVersion: number;
  exportedAt: string;
  profiles: Profile[];
}

export function toBackup(profiles: Profile[]): BackupFile {
  return { app: APP, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), profiles };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function isProfile(v: unknown): v is Profile {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    isObject(v.choices) &&
    isObject(v.maturite) &&
    Array.isArray(v.years) &&
    v.years.every(
      (y) =>
        isObject(y) &&
        typeof y.id === 'string' &&
        [1, 2, 3].includes(y.level as number) &&
        Array.isArray(y.tests) &&
        isObject(y.overrides),
    )
  );
}

/** Parses an exported file; throws a French message when it is not valid. */
export function parseBackup(text: string): Profile[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Le fichier n’est pas un JSON valide.');
  }
  if (!isObject(data) || data.app !== APP) throw new Error('Ce fichier n’est pas une sauvegarde Lycée Tracker.');
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion > SCHEMA_VERSION)
    throw new Error('Cette sauvegarde provient d’une version plus récente de l’application.');
  if (!Array.isArray(data.profiles) || !data.profiles.every(isProfile))
    throw new Error('La sauvegarde est incomplète ou corrompue.');
  return data.profiles;
}

export function downloadBackup(profiles: Profile[]): void {
  const blob = new Blob([JSON.stringify(toBackup(profiles), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lycee-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
