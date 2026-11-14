import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { overrideKey } from '../domain/averages';
import { createKey, open, seal, WrongPasswordError, type UnlockedKey } from '../crypto/vault';
import type { Choices, Level, Profile, SchoolYear, SubGrade, Test } from '../domain/types';
import { newId } from './id';
import { loadEntries, loadPayload, SCHEMA_VERSION, type SealedPayload, type VaultEntry } from './schema';

export { newId };

const STORAGE_KEY = 'lycee-tracker';

/** Calendar label of the current school year (it starts in August). */
export function currentSchoolYearLabel(date = new Date()): string {
  const start = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

type ProfilePatch = Partial<Pick<Profile, 'name' | 'choices'>>;
type YearPatch = Partial<Pick<SchoolYear, 'level' | 'label'>>;

/** Local backup reminder; never exported. */
export interface BackupState {
  /** Reminder interval in days; 0 disables it. */
  frequencyDays: number;
  /** First data change not covered by an export. */
  unsavedSince?: string;
  lastExportAt?: string;
  snoozedUntil?: string;
}

const DAY = 24 * 60 * 60 * 1000;

interface State {
  /** Stored profiles, encrypted (persisted). */
  vault: VaultEntry[];
  /** Unlocked profiles, decrypted in memory only. */
  profiles: Profile[];
  backup: BackupState;
  createProfile: (name: string, choices: Choices, level: Level, label: string, password: string) => Promise<Profile>;
  /** Throws WrongPasswordError. */
  unlock: (id: string, password: string) => Promise<void>;
  /** Encrypts a profile saved before passwords existed. */
  protectLegacy: (id: string, password: string) => Promise<void>;
  lock: (id: string) => void;
  /** Throws WrongPasswordError when the current password is wrong. */
  changePassword: (id: string, current: string, next: string) => Promise<void>;
  importEntries: (entries: VaultEntry[]) => void;
  markExported: () => void;
  snoozeReminder: (days?: number) => void;
  setReminderFrequency: (days: number) => void;
  updateProfile: (id: string, patch: ProfilePatch) => void;
  deleteProfile: (id: string) => void;
  addYear: (profileId: string, level: Level, label: string) => SchoolYear;
  updateYear: (profileId: string, yearId: string, patch: YearPatch) => void;
  deleteYear: (profileId: string, yearId: string) => void;
  addTest: (profileId: string, yearId: string, test: Omit<Test, 'id'>) => void;
  updateTest: (profileId: string, yearId: string, testId: string, patch: Partial<Omit<Test, 'id'>>) => void;
  deleteTest: (profileId: string, yearId: string, testId: string) => void;
  addPart: (profileId: string, yearId: string, testId: string, part: Omit<SubGrade, 'id'>) => void;
  updatePart: (
    profileId: string,
    yearId: string,
    testId: string,
    partId: string,
    patch: Partial<Omit<SubGrade, 'id'>>,
  ) => void;
  deletePart: (profileId: string, yearId: string, testId: string, partId: string) => void;
  setOverride: (profileId: string, yearId: string, disciplineId: string, grade: number | null) => void;
  setExam: (profileId: string, disciplineId: string, grade: number | null) => void;
  setSchoolOverride: (profileId: string, disciplineId: string, grade: number | null) => void;
  setTm: (profileId: string, grade: number | null) => void;
}

/** Keys of unlocked profiles: memory only, gone on reload. */
const keys = new Map<string, UnlockedKey>();

const toEntry = (p: Profile, sealed: VaultEntry['sealed']): VaultEntry => ({
  id: p.id,
  name: p.name,
  createdAt: p.createdAt,
  sealed,
});

const sealProfile = (p: Profile, key: UnlockedKey) =>
  seal({ schemaVersion: SCHEMA_VERSION, profile: p } satisfies SealedPayload, key);

function setKey(record: Record<string, number>, key: string, value: number | null): Record<string, number> {
  const next = { ...record };
  if (value === null) delete next[key];
  else next[key] = value;
  return next;
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      // Every data change starts the "unsaved" period unless one is already running.
      const changed = (s: State): Pick<State, 'backup'> => ({
        backup: s.backup.unsavedSince ? s.backup : { ...s.backup, unsavedSince: new Date().toISOString() },
      });
      const mapProfile = (id: string, fn: (p: Profile) => Profile) =>
        set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? fn(p) : p)), ...changed(s) }));
      const mapYear = (profileId: string, yearId: string, fn: (y: SchoolYear) => SchoolYear) =>
        mapProfile(profileId, (p) => ({ ...p, years: p.years.map((y) => (y.id === yearId ? fn(y) : y)) }));
      const mapParts = (profileId: string, yearId: string, testId: string, fn: (parts: SubGrade[]) => SubGrade[]) =>
        mapYear(profileId, yearId, (y) => ({
          ...y,
          tests: y.tests.map((t) => (t.id === testId ? { ...t, parts: fn(t.parts ?? []) } : t)),
        }));

      return {
        vault: [],
        profiles: [],
        backup: { frequencyDays: 7 },

        createProfile: async (name, choices, level, label, password) => {
          const profile: Profile = {
            id: newId(),
            name,
            choices,
            years: [{ id: newId(), level, label, tests: [], overrides: {} }],
            maturite: { exams: {}, schoolOverrides: {} },
            createdAt: new Date().toISOString(),
          };
          const key = await createKey(password);
          keys.set(profile.id, key);
          const entry = toEntry(profile, await sealProfile(profile, key));
          set((s) => ({ vault: [...s.vault, entry], profiles: [...s.profiles, profile], ...changed(s) }));
          return profile;
        },
        unlock: async (id, password) => {
          const entry = get().vault.find((e) => e.id === id);
          if (!entry?.sealed) throw new WrongPasswordError();
          const { value, key } = await open(entry.sealed, password);
          const profile = loadPayload(value, id);
          keys.set(id, key);
          set((s) => ({ profiles: [...s.profiles.filter((p) => p.id !== id), profile] }));
        },
        protectLegacy: async (id, password) => {
          const profile = get().vault.find((e) => e.id === id)?.legacy;
          if (!profile) return;
          const key = await createKey(password);
          keys.set(id, key);
          const entry = toEntry(profile, await sealProfile(profile, key));
          set((s) => ({
            vault: s.vault.map((e) => (e.id === id ? entry : e)),
            profiles: [...s.profiles.filter((p) => p.id !== id), profile],
            ...changed(s),
          }));
        },
        lock: (id) => {
          keys.delete(id);
          set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }));
        },
        changePassword: async (id, current, next) => {
          const entry = get().vault.find((e) => e.id === id);
          const profile = get().profiles.find((p) => p.id === id);
          if (!entry?.sealed || !profile) throw new WrongPasswordError();
          await open(entry.sealed, current); // verifies the current password
          const key = await createKey(next);
          keys.set(id, key);
          const updated = toEntry(profile, await sealProfile(profile, key));
          set((s) => ({ vault: s.vault.map((e) => (e.id === id ? updated : e)), ...changed(s) }));
        },
        // Entries with the same id are replaced (and locked), the others are added.
        importEntries: (incoming) =>
          set((s) => {
            const ids = new Set(incoming.map((e) => e.id));
            ids.forEach((id) => keys.delete(id));
            return {
              vault: [...s.vault.filter((e) => !ids.has(e.id)), ...incoming],
              profiles: s.profiles.filter((p) => !ids.has(p.id)),
              ...changed(s),
            };
          }),

        markExported: () =>
          set((s) => ({
            backup: {
              ...s.backup,
              unsavedSince: undefined,
              snoozedUntil: undefined,
              lastExportAt: new Date().toISOString(),
            },
          })),
        snoozeReminder: (days = 1) =>
          set((s) => ({ backup: { ...s.backup, snoozedUntil: new Date(Date.now() + days * DAY).toISOString() } })),
        setReminderFrequency: (frequencyDays) => set((s) => ({ backup: { ...s.backup, frequencyDays } })),

        updateProfile: (id, patch) => mapProfile(id, (p) => ({ ...p, ...patch })),
        deleteProfile: (id) => {
          keys.delete(id);
          set((s) => ({
            vault: s.vault.filter((e) => e.id !== id),
            profiles: s.profiles.filter((p) => p.id !== id),
            ...changed(s),
          }));
        },

        addYear: (profileId, level, label) => {
          const year: SchoolYear = { id: newId(), level, label, tests: [], overrides: {} };
          mapProfile(profileId, (p) => ({ ...p, years: [...p.years, year] }));
          return year;
        },
        updateYear: (profileId, yearId, patch) => mapYear(profileId, yearId, (y) => ({ ...y, ...patch })),
        deleteYear: (profileId, yearId) =>
          mapProfile(profileId, (p) => ({ ...p, years: p.years.filter((y) => y.id !== yearId) })),

        addTest: (profileId, yearId, test) =>
          mapYear(profileId, yearId, (y) => ({ ...y, tests: [...y.tests, { ...test, id: newId() }] })),
        updateTest: (profileId, yearId, testId, patch) =>
          mapYear(profileId, yearId, (y) => ({
            ...y,
            tests: y.tests.map((t) => (t.id === testId ? { ...t, ...patch } : t)),
          })),
        deleteTest: (profileId, yearId, testId) =>
          mapYear(profileId, yearId, (y) => ({ ...y, tests: y.tests.filter((t) => t.id !== testId) })),

        addPart: (profileId, yearId, testId, part) =>
          mapParts(profileId, yearId, testId, (parts) => [...parts, { ...part, id: newId() }]),
        updatePart: (profileId, yearId, testId, partId, patch) =>
          mapParts(profileId, yearId, testId, (parts) => parts.map((p) => (p.id === partId ? { ...p, ...patch } : p))),
        deletePart: (profileId, yearId, testId, partId) =>
          mapParts(profileId, yearId, testId, (parts) => parts.filter((p) => p.id !== partId)),

        setOverride: (profileId, yearId, disciplineId, grade) =>
          mapYear(profileId, yearId, (y) => ({
            ...y,
            overrides: setKey(y.overrides, overrideKey(disciplineId), grade),
          })),
        setExam: (profileId, disciplineId, grade) =>
          mapProfile(profileId, (p) => ({
            ...p,
            maturite: { ...p.maturite, exams: setKey(p.maturite.exams, disciplineId, grade) },
          })),
        setSchoolOverride: (profileId, disciplineId, grade) =>
          mapProfile(profileId, (p) => ({
            ...p,
            maturite: { ...p.maturite, schoolOverrides: setKey(p.maturite.schoolOverrides, disciplineId, grade) },
          })),
        setTm: (profileId, grade) =>
          mapProfile(profileId, (p) => ({ ...p, maturite: { ...p.maturite, tm: grade ?? undefined } })),

      };
    },
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      // Only encrypted entries are written; unlocked profiles never reach the storage.
      partialize: (s) => ({ vault: s.vault, backup: s.backup }),
      // Same migration chain as imported files; keeps a raw copy of the old data first.
      migrate: (persisted, version) => {
        snapshot(`pre-v${version}`);
        const p = (persisted ?? {}) as Partial<State>;
        const raw = version < 2 ? p.profiles : p.vault;
        return {
          vault: loadEntries(raw ?? [], version).entries,
          backup: { frequencyDays: 7, ...p.backup },
        };
      },
      // Repairs saved data on every load; unreadable data is kept aside instead of being overwritten.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        try {
          return {
            ...current,
            vault: loadEntries(p.vault ?? [], SCHEMA_VERSION).entries,
            backup: { ...current.backup, ...p.backup },
          };
        } catch {
          snapshot('unreadable');
          return current;
        }
      },
    },
  ),
);

/** Copies the raw saved data to a side key so a failed migration never destroys it. */
function snapshot(reason: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) localStorage.setItem(`${STORAGE_KEY}:${reason}:${new Date().toISOString()}`, raw);
  } catch {
    // Storage full or unavailable: nothing more we can do.
  }
}

export function useProfile(id: string | undefined): Profile | undefined {
  return useStore((s) => s.profiles.find((p) => p.id === id));
}

/** Days since the oldest unsaved change when the reminder is due, else null. */
export function reminderDueDays(b: BackupState, now = Date.now()): number | null {
  if (!b.frequencyDays || !b.unsavedSince) return null;
  if (b.snoozedUntil && now < Date.parse(b.snoozedUntil)) return null;
  const days = Math.floor((now - Date.parse(b.unsavedSince)) / DAY);
  return days >= b.frequencyDays ? days : null;
}

// Re-encrypt every unlocked profile that changed. A sequence number per profile makes sure an
// older encryption finishing late never overwrites a newer one.
const sequence = new Map<string, number>();
const pending = new Set<Promise<void>>();

useStore.subscribe((state, prev) => {
  if (state.profiles === prev.profiles) return;
  const before = new Map(prev.profiles.map((p) => [p.id, p]));
  for (const profile of state.profiles) {
    const key = keys.get(profile.id);
    if (!key || before.get(profile.id) === profile) continue;
    const n = (sequence.get(profile.id) ?? 0) + 1;
    sequence.set(profile.id, n);
    const job = sealProfile(profile, key).then((sealed) => {
      if (sequence.get(profile.id) !== n) return;
      useStore.setState((s) => ({
        vault: s.vault.map((e) => (e.id === profile.id ? toEntry(profile, sealed) : e)),
      }));
    });
    pending.add(job);
    void job.finally(() => pending.delete(job));
  }
});

/** Waits until every change is encrypted into the vault (before exporting). */
export async function flushVault(): Promise<void> {
  while (pending.size) await Promise.all([...pending]);
}

export function useEntry(id: string | undefined): VaultEntry | undefined {
  return useStore((s) => s.vault.find((e) => e.id === id));
}
