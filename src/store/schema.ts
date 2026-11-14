/**
 * Data format of saved profiles (browser storage and exported files).
 *
 * Rules for changing the format without losing anybody's grades:
 * 1. Never rename or reuse an existing field or discipline id in place.
 * 2. Adding an optional field needs nothing: `sanitizeProfiles` keeps unknown fields and fills defaults.
 * 3. Any other change bumps SCHEMA_VERSION and adds MIGRATIONS[oldVersion] converting the old shape.
 * 4. Keep the old fixture in src/store/fixtures/ and add one for the new version; the tests import them all.
 * See docs/data-format.md.
 */
import { ARTS_LABELS, BILINGUAL_EXAM_LABELS, L2_LABELS, L3_LABELS, OC_LABELS, OS_LABELS } from '../data/curriculum';
import type { Choices, Level, Profile, SchoolYear, Semester, SubGrade, Test } from '../domain/types';
import { newId } from './id';

export const SCHEMA_VERSION = 1;

/** MIGRATIONS[n] converts the profiles array of version n into version n + 1. */
type Migration = (profiles: unknown[]) => unknown[];
export const MIGRATIONS: Record<number, Migration> = {};

export interface LoadResult {
  profiles: Profile[];
  /** Human-readable notes about repaired or skipped data (in French, shown to the user). */
  warnings: string[];
}

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isGrade = (v: unknown): v is number => typeof v === 'number' && v >= 1 && v <= 6;
const isSemester = (v: unknown): v is Semester => v === 1 || v === 2;
const optString = (v: unknown) => (typeof v === 'string' ? v : undefined);

function gradeRecord(v: unknown): Record<string, number> {
  if (!isObject(v)) return {};
  return Object.fromEntries(Object.entries(v).filter(([, g]) => isGrade(g))) as Record<string, number>;
}

function pick<T extends string>(
  value: unknown,
  labels: Record<T, string>,
  fallback: T,
  what: string,
  warn: (m: string) => void,
): T {
  if (typeof value === 'string' && value in labels) return value as T;
  warn(`${what} inconnu(e) « ${String(value)} », remplacé(e) par « ${labels[fallback]} ».`);
  return fallback;
}

function sanitizeChoices(v: unknown, warn: (m: string) => void): Choices {
  const c = isObject(v) ? v : {};
  const choices: Choices = {
    ...(c as object),
    track: c.track === 'bilingue' ? 'bilingue' : 'standard',
    l2: pick(c.l2, L2_LABELS, 'allemand', 'Langue 2', warn),
    l3: pick(c.l3, L3_LABELS, 'anglais', 'Langue 3', warn),
    arts: pick(c.arts, ARTS_LABELS, 'arts-visuels', 'Discipline artistique', warn),
    os: pick(c.os, OS_LABELS, 'espagnol', 'Option spécifique', warn),
  };
  if (c.oc === undefined || c.oc === null) delete choices.oc;
  else if (typeof c.oc === 'string' && c.oc in OC_LABELS) choices.oc = c.oc as Choices['oc'];
  else {
    warn(`Option complémentaire inconnue « ${String(c.oc)} » : à choisir à nouveau.`);
    delete choices.oc;
  }
  if (choices.track === 'bilingue')
    choices.bilingualExam = pick(c.bilingualExam, BILINGUAL_EXAM_LABELS, 'physique', 'Examen bilingue', warn);
  return choices;
}

function sanitizePart(v: unknown): SubGrade | null {
  if (!isObject(v) || !isGrade(v.grade) || !isSemester(v.semester)) return null;
  return { ...v, id: optString(v.id) ?? newId(), grade: v.grade, semester: v.semester, date: optString(v.date) };
}

function sanitizeTest(v: unknown): Test | null {
  if (!isObject(v) || typeof v.disciplineId !== 'string' || !isSemester(v.semester)) return null;
  const weight = typeof v.weight === 'number' && v.weight > 0 ? v.weight : 1;
  const base = {
    ...v,
    id: optString(v.id) ?? newId(),
    disciplineId: v.disciplineId,
    branchId: optString(v.branchId),
    semester: v.semester,
    weight,
    label: optString(v.label),
    date: optString(v.date),
  };
  if (Array.isArray(v.parts)) {
    const rounding = v.rounding === 'quarter' || v.rounding === 'none' ? v.rounding : 'tenth';
    const parts = v.parts.map(sanitizePart).filter((p): p is SubGrade => p !== null);
    return { ...base, grade: 0, parts, rounding };
  }
  if (!isGrade(v.grade)) return null;
  const { parts: _parts, rounding: _rounding, ...simple } = { ...base, grade: v.grade } as Test;
  return simple;
}

function sanitizeYear(v: unknown, warn: (m: string) => void): SchoolYear | null {
  if (!isObject(v) || ![1, 2, 3].includes(v.level as number)) return null;
  const rawTests = Array.isArray(v.tests) ? v.tests : [];
  const tests = rawTests.map(sanitizeTest).filter((t): t is Test => t !== null);
  if (tests.length < rawTests.length) warn(`${rawTests.length - tests.length} note(s) illisible(s) ignorée(s).`);
  return {
    ...v,
    id: optString(v.id) ?? newId(),
    level: v.level as Level,
    label: optString(v.label) ?? '',
    tests,
    overrides: gradeRecord(v.overrides),
  };
}

function sanitizeProfile(v: unknown, warnings: string[]): Profile | null {
  if (!isObject(v) || typeof v.name !== 'string') return null;
  const warn = (m: string) => warnings.push(`${v.name} : ${m}`);
  const rawYears = Array.isArray(v.years) ? v.years : [];
  const years = rawYears.map((y) => sanitizeYear(y, warn)).filter((y): y is SchoolYear => y !== null);
  if (years.length < rawYears.length) warn(`${rawYears.length - years.length} année(s) illisible(s) ignorée(s).`);
  const m = isObject(v.maturite) ? v.maturite : {};
  return {
    ...v,
    id: optString(v.id) ?? newId(),
    name: v.name,
    choices: sanitizeChoices(v.choices, warn),
    years,
    maturite: {
      ...m,
      exams: gradeRecord(m.exams),
      schoolOverrides: gradeRecord(m.schoolOverrides),
      tm: isGrade(m.tm) ? m.tm : undefined,
    },
    createdAt: optString(v.createdAt) ?? new Date().toISOString(),
  };
}

/**
 * Repairs profiles of the current version: fills defaults, drops entries that cannot be read
 * (reported in warnings) and keeps unknown fields. Throws only when the data is not a list.
 */
export function sanitizeProfiles(raw: unknown): LoadResult {
  if (!Array.isArray(raw)) throw new Error('Les données ne contiennent pas de liste de profils.');
  const warnings: string[] = [];
  const profiles = raw.map((p) => sanitizeProfile(p, warnings)).filter((p): p is Profile => p !== null);
  if (profiles.length < raw.length) warnings.push(`${raw.length - profiles.length} profil(s) illisible(s) ignoré(s).`);
  return { profiles, warnings };
}

/** Brings profiles saved with an older schema version up to date, then repairs them. */
export function loadProfiles(raw: unknown, version: number): LoadResult {
  if (version > SCHEMA_VERSION)
    throw new Error('Ces données proviennent d’une version plus récente de l’application. Recharge la page.');
  let data = raw;
  for (let v = version; v < SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate) throw new Error(`Migration manquante depuis la version ${v}.`);
    data = migrate(Array.isArray(data) ? data : []);
  }
  return sanitizeProfiles(data);
}
