import { allDisciplines, CORE_MATURITE_DISCIPLINES, disciplinesFor, lastLevelTaught } from '../data/curriculum';
import { annualResult, roundHalf } from './averages';
import { checkRules, type RuleCheck } from './rules';
import type { Profile } from './types';

export const TM_ID = 'tm';

export interface MaturiteRow {
  id: string;
  name: string;
  withExam: boolean;
  /** Average of the last full year the discipline was taught (412.351 art. 14 al. 3). */
  school: number | null;
  schoolOverridden: boolean;
  exam: number | null;
  /** Maturité grade, rounded to the half point. */
  final: number | null;
}

export interface MaturiteResult {
  rows: MaturiteRow[];
  check: RuleCheck;
  coreSum: number;
  coreOk: boolean;
  complete: boolean;
  passed: boolean;
}

export const CORE_MINIMUM = 16;

/** School grade from the last year of the profile at the level where the discipline was last taught. */
export function schoolGrade(profile: Profile, disciplineId: string): number | null {
  const level = lastLevelTaught(profile.choices, disciplineId);
  if (level === null) return null;
  const year = [...profile.years].reverse().find((y) => y.level === level);
  if (!year) return null;
  const discipline = disciplinesFor(profile.choices, level).find((d) => d.id === disciplineId);
  return discipline ? annualResult(discipline, year).value : null;
}

export function maturiteGrade(school: number | null, exam: number | null, withExam: boolean): number | null {
  if (school === null) return null;
  if (!withExam) return roundHalf(school);
  return exam === null ? null : roundHalf((school + exam) / 2);
}

export function evaluateMaturite(profile: Profile): MaturiteResult {
  const { exams, schoolOverrides, tm } = profile.maturite;
  const rows: MaturiteRow[] = allDisciplines(profile.choices)
    .filter((d) => d.maturite !== null)
    .map((d) => {
      const withExam = d.maturite === 'exam';
      const override = schoolOverrides[d.id];
      const school = override ?? schoolGrade(profile, d.id);
      const exam = withExam ? (exams[d.id] ?? null) : null;
      return {
        id: d.id,
        name: d.name,
        withExam,
        school,
        schoolOverridden: override !== undefined,
        exam,
        final: maturiteGrade(school, exam, withExam),
      };
    });
  rows.push({
    id: TM_ID,
    name: 'Travail de maturité',
    withExam: false,
    school: tm ?? null,
    schoolOverridden: false,
    exam: null,
    final: tm ?? null,
  });

  const finals = rows.map((r) => r.final).filter((g): g is number => g !== null);
  const check = checkRules(finals);
  const coreSum = rows
    .filter((r) => CORE_MATURITE_DISCIPLINES.includes(r.id))
    .reduce((s, r) => s + (r.final ?? 0), 0);
  const coreOk = coreSum >= CORE_MINIMUM;
  const complete = finals.length === rows.length;
  return { rows, check, coreSum, coreOk, complete, passed: complete && check.passed && coreOk };
}
