import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { overrideKey } from '../domain/averages';
import type { Choices, Level, Profile, SchoolYear, Semester, Test } from '../domain/types';

export const SCHEMA_VERSION = 1;

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Calendar label of the current school year (it starts in August). */
export function currentSchoolYearLabel(date = new Date()): string {
  const start = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

type ProfilePatch = Partial<Pick<Profile, 'name' | 'choices'>>;
type YearPatch = Partial<Pick<SchoolYear, 'level' | 'label'>>;

interface State {
  profiles: Profile[];
  addProfile: (name: string, choices: Choices, level: Level, label: string) => Profile;
  updateProfile: (id: string, patch: ProfilePatch) => void;
  deleteProfile: (id: string) => void;
  addYear: (profileId: string, level: Level, label: string) => SchoolYear;
  updateYear: (profileId: string, yearId: string, patch: YearPatch) => void;
  deleteYear: (profileId: string, yearId: string) => void;
  addTest: (profileId: string, yearId: string, test: Omit<Test, 'id'>) => void;
  updateTest: (profileId: string, yearId: string, testId: string, patch: Partial<Omit<Test, 'id'>>) => void;
  deleteTest: (profileId: string, yearId: string, testId: string) => void;
  setOverride: (profileId: string, yearId: string, disciplineId: string, semester: Semester, grade: number | null) => void;
  setExam: (profileId: string, disciplineId: string, grade: number | null) => void;
  setSchoolOverride: (profileId: string, disciplineId: string, grade: number | null) => void;
  setTm: (profileId: string, grade: number | null) => void;
  importProfiles: (profiles: Profile[]) => void;
}

function setKey(record: Record<string, number>, key: string, value: number | null): Record<string, number> {
  const next = { ...record };
  if (value === null) delete next[key];
  else next[key] = value;
  return next;
}

export const useStore = create<State>()(
  persist(
    (set) => {
      const mapProfile = (id: string, fn: (p: Profile) => Profile) =>
        set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? fn(p) : p)) }));
      const mapYear = (profileId: string, yearId: string, fn: (y: SchoolYear) => SchoolYear) =>
        mapProfile(profileId, (p) => ({ ...p, years: p.years.map((y) => (y.id === yearId ? fn(y) : y)) }));

      return {
        profiles: [],

        addProfile: (name, choices, level, label) => {
          const profile: Profile = {
            id: newId(),
            name,
            choices,
            years: [{ id: newId(), level, label, tests: [], overrides: {} }],
            maturite: { exams: {}, schoolOverrides: {} },
            createdAt: new Date().toISOString(),
          };
          set((s) => ({ profiles: [...s.profiles, profile] }));
          return profile;
        },
        updateProfile: (id, patch) => mapProfile(id, (p) => ({ ...p, ...patch })),
        deleteProfile: (id) => set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) })),

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

        setOverride: (profileId, yearId, disciplineId, semester, grade) =>
          mapYear(profileId, yearId, (y) => ({
            ...y,
            overrides: setKey(y.overrides, overrideKey(disciplineId, semester), grade),
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

        // Profiles with the same id are replaced, the others are added.
        importProfiles: (incoming) =>
          set((s) => {
            const ids = new Set(incoming.map((p) => p.id));
            return { profiles: [...s.profiles.filter((p) => !ids.has(p.id)), ...incoming] };
          }),
      };
    },
    {
      name: 'lycee-tracker',
      version: SCHEMA_VERSION,
      partialize: (s) => ({ profiles: s.profiles }),
      // Future schema changes: migrate (persisted, version) => new state here.
    },
  ),
);

export function useProfile(id: string | undefined): Profile | undefined {
  return useStore((s) => s.profiles.find((p) => p.id === id));
}
