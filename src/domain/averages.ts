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

export interface SemesterResult {
  /** Unrounded average of the tests. */
  raw: number | null;
  /** Bulletin grade: the student's override, else the raw average rounded to the half point. */
  official: number | null;
  overridden: boolean;
  branches?: BranchResult[];
}

export const overrideKey = (disciplineId: string, semester: Semester) => `${disciplineId}:${semester}`;

export function testsFor(year: SchoolYear, disciplineId: string, semester: Semester): Test[] {
  return year.tests.filter((t) => t.disciplineId === disciplineId && t.semester === semester);
}

/** Tests without a known branch go to the first branch. */
export function branchOf(discipline: Discipline, test: Test): string | undefined {
  const branches = discipline.branches;
  if (!branches?.length) return undefined;
  return branches.some((b) => b.id === test.branchId) ? test.branchId : branches[0].id;
}

export function semesterResult(discipline: Discipline, year: SchoolYear, semester: Semester): SemesterResult {
  const tests = testsFor(year, discipline.id, semester);
  const override = year.overrides[overrideKey(discipline.id, semester)];
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

export interface AnnualResult {
  s1: SemesterResult;
  s2: SemesterResult;
  /** Mean of the two semester grades (art. 30); not rounded. */
  value: number | null;
  /** True when only one semester has a grade so far. */
  provisional: boolean;
}

export function annualResult(discipline: Discipline, year: SchoolYear): AnnualResult {
  const s1 = semesterResult(discipline, year, 1);
  const s2 = semesterResult(discipline, year, 2);
  const grades = [s1.official, s2.official].filter((g): g is number => g !== null);
  const value = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : null;
  return { s1, s2, value, provisional: grades.length === 1 };
}
