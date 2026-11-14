import type { Discipline, SchoolYear, Semester, Test } from './types';

const EPS = 1e-9;

/**
 * Rounds to the nearest half point; x.25 and x.75 round up
 * (RSJU 412.311.1 art. 29 al. 4, 412.351 art. 14 al. 5).
 */
export function roundHalf(x: number): number {
  return Math.round(x * 2 + EPS) / 2;
}

export function weightedMean(items: { value: number; weight: number }[]): number | null {
  const total = items.reduce((s, i) => s + i.weight, 0);
  if (total <= 0) return null;
  return items.reduce((s, i) => s + i.value * i.weight, 0) / total;
}

export function testsMean(tests: Test[]): number | null {
  return weightedMean(tests.map((t) => ({ value: t.grade, weight: t.weight })));
}

export interface BranchResult {
  id: string;
  name: string;
  raw: number | null;
  official: number | null;
}

export interface PeriodResult {
  /** Unrounded weighted average of the tests. */
  raw: number | null;
  /** Average rounded to the half point (or the bulletin grade when entered). */
  official: number | null;
  overridden: boolean;
  branches?: BranchResult[];
}

/** Annual bulletin grade entered by the student, keyed by disciplineId. */
export const overrideKey = (disciplineId: string) => disciplineId;

/** Tests of a discipline for one semester, or for the whole year when semester is omitted. */
export function testsFor(year: SchoolYear, disciplineId: string, semester?: Semester): Test[] {
  return year.tests.filter((t) => t.disciplineId === disciplineId && (semester === undefined || t.semester === semester));
}

/** Tests without a known branch go to the first branch. */
export function branchOf(discipline: Discipline, test: Test): string | undefined {
  const branches = discipline.branches;
  if (!branches?.length) return undefined;
  return branches.some((b) => b.id === test.branchId) ? test.branchId : branches[0].id;
}

function periodResult(discipline: Discipline, tests: Test[], override?: number): PeriodResult {
  const overridden = override !== undefined;

  if (!discipline.branches?.length) {
    const raw = testsMean(tests);
    return { raw, official: overridden ? override : raw === null ? null : roundHalf(raw), overridden };
  }

  // Multi-branch discipline: half-point grade per branch, then mean weighted by lessons (art. 29 al. 4).
  const branches: BranchResult[] = discipline.branches.map((b) => {
    const raw = testsMean(tests.filter((t) => branchOf(discipline, t) === b.id));
    return { id: b.id, name: b.name, raw, official: raw === null ? null : roundHalf(raw) };
  });
  const raw = weightedMean(
    discipline.branches.flatMap((b, i) => {
      const official = branches[i].official;
      return official === null ? [] : [{ value: official, weight: b.weight }];
    }),
  );
  return {
    raw,
    official: overridden ? override : raw === null ? null : roundHalf(raw),
    overridden,
    branches,
  };
}

/** Semester average: for information only, the annual grade uses every test of the year. */
export function semesterResult(discipline: Discipline, year: SchoolYear, semester: Semester): PeriodResult {
  return periodResult(discipline, testsFor(year, discipline.id, semester));
}

export interface AnnualResult extends PeriodResult {
  s1: PeriodResult;
  s2: PeriodResult;
  /** Grade used for promotion: the official annual grade. */
  value: number | null;
  /** True while the 2nd semester has no test and no bulletin grade was entered. */
  provisional: boolean;
}

/** Annual grade: weighted average of all the tests of the year, rounded to the half point. */
export function annualResult(discipline: Discipline, year: SchoolYear): AnnualResult {
  const year_ = periodResult(discipline, testsFor(year, discipline.id), year.overrides[overrideKey(discipline.id)]);
  const s1 = semesterResult(discipline, year, 1);
  const s2 = semesterResult(discipline, year, 2);
  return {
    ...year_,
    s1,
    s2,
    value: year_.official,
    provisional: !year_.overridden && year_.official !== null && s2.raw === null,
  };
}
