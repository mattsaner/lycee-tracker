import { describe, expect, it } from 'vitest';
import { disciplinesFor, lastLevelTaught } from '../data/curriculum';
import { annualResult, compositeValue, roundHalf, roundTo, semesterResult } from './averages';
import { allowedOc, allowedOs, normalizeChoices, ocMissing, validateChoices } from './choices';
import { evaluateMaturite, maturiteGrade } from './maturite';
import { evaluatePromotion } from './promotion';
import { neededGrade } from './projection';
import { checkRules } from './rules';
import type { Choices, CompositeRounding, Profile, SchoolYear, Semester, Test } from './types';

const choices: Choices = {
  track: 'standard',
  l2: 'allemand',
  l3: 'anglais',
  arts: 'musique',
  os: 'bc',
  oc: 'histoire',
};

let n = 0;
const test = (disciplineId: string, grade: number, semester: Semester = 1, extra: Partial<Test> = {}): Test => ({
  id: String(n++),
  disciplineId,
  semester,
  grade,
  weight: 1,
  ...extra,
});

const year = (level: 1 | 2 | 3, tests: Test[] = [], overrides: Record<string, number> = {}): SchoolYear => ({
  id: `y${level}`,
  level,
  label: '2025-2026',
  tests,
  overrides,
});

describe('roundHalf', () => {
  it('rounds to the nearest half point', () => {
    expect(roundHalf(4.2)).toBe(4);
    expect(roundHalf(4.3)).toBe(4.5);
    expect(roundHalf(4.7)).toBe(4.5);
    expect(roundHalf(4.8)).toBe(5);
  });
  it('rounds .25 and .75 up (art. 29 al. 4)', () => {
    expect(roundHalf(4.25)).toBe(4.5);
    expect(roundHalf(4.75)).toBe(5);
    expect(roundHalf(3.75)).toBe(4);
  });
  it('is robust to floating point noise', () => {
    expect(roundHalf((4.5 + 4) / 2)).toBe(4.5);
    expect(roundHalf(0.1 * 3 + 3.95)).toBe(4.5); // 4.25000000000004
  });
});

describe('semester and annual grades', () => {
  const francais = disciplinesFor(choices, 1).find((d) => d.id === 'francais')!;
  const os = disciplinesFor(choices, 1).find((d) => d.id === 'os')!;

  it('uses the weighted mean of the tests, rounded to the half point', () => {
    const y = year(1, [test('francais', 4.2), test('francais', 5.1, 1, { weight: 2 })]);
    const r = semesterResult(francais, y, 1);
    expect(r.raw).toBeCloseTo(4.8);
    expect(r.official).toBe(5);
  });

  it('accepts tenth and quarter grades', () => {
    const y = year(1, [test('francais', 3.75), test('francais', 4.1)]);
    expect(semesterResult(francais, y, 1).raw).toBeCloseTo(3.925);
    expect(semesterResult(francais, y, 1).official).toBe(4);
  });

  it('lets the annual bulletin grade override the computed one', () => {
    const y = year(1, [test('francais', 4.2)], { francais: 4.5 });
    const r = annualResult(francais, y);
    expect(r.value).toBe(4.5);
    expect(r.overridden).toBe(true);
    expect(r.provisional).toBe(false);
  });

  it('averages branch half-point grades for a multi-branch OS', () => {
    const y = year(1, [
      test('os', 4.6, 1, { branchId: 'biologie' }), // → 4.5
      test('os', 5.3, 1, { branchId: 'chimie' }), // → 5.5
    ]);
    const r = semesterResult(os, y, 1);
    expect(r.branches?.map((b) => b.official)).toEqual([4.5, 5.5]);
    expect(r.raw).toBe(5);
    expect(r.official).toBe(5);
  });

  it('annual grade is the weighted mean of every test of the year, not of the semesters', () => {
    // S1: 4 → semester 4; S2: 5, 5, 5 → semester 5. Mean of semesters would be 4.5.
    const y = year(1, [test('francais', 4, 1), test('francais', 5, 2), test('francais', 5, 2), test('francais', 5, 2)]);
    const a = annualResult(francais, y);
    expect(a.raw).toBe(4.75);
    expect(a.value).toBe(5);
    expect(a.s1.official).toBe(4);
    expect(a.s2.official).toBe(5);
    expect(a.provisional).toBe(false);
  });

  it('uses test weights across the year', () => {
    const y = year(1, [test('francais', 3, 1, { weight: 2 }), test('francais', 6, 2)]);
    expect(annualResult(francais, y).raw).toBe(4);
  });

  it('marks the annual grade provisional before any 2nd semester test', () => {
    const a = annualResult(francais, year(1, [test('francais', 4.4, 1)]));
    expect(a.value).toBe(4.5);
    expect(a.provisional).toBe(true);
  });

  it('computes multi-branch annual grades from all the year tests per branch', () => {
    const y = year(1, [
      test('os', 4, 1, { branchId: 'biologie' }),
      test('os', 5, 2, { branchId: 'biologie' }), // biologie 4.5
      test('os', 6, 2, { branchId: 'chimie' }), // chimie 6
    ]);
    const a = annualResult(os, y);
    expect(a.branches?.map((b) => b.official)).toEqual([4.5, 6]);
    expect(a.raw).toBe(5.25);
    expect(a.value).toBe(5.5);
  });
});

describe('checkRules (double compensation)', () => {
  it('passes when twice the deficit equals the surplus', () => {
    // deficit 1 (3) → doubled 2; surplus 2 (5 + 5)
    const r = checkRules([3, 5, 5, 4]);
    expect(r.margin).toBe(0);
    expect(r.passed).toBe(true);
  });
  it('fails when twice the deficit exceeds the surplus', () => {
    const r = checkRules([3, 5, 4.5]);
    expect(r.compensationOk).toBe(false);
    expect(r.passed).toBe(false);
  });
  it('fails with 5 insufficient grades even if compensated', () => {
    const r = checkRules([3.5, 3.5, 3.5, 3.5, 3.5, 6, 6, 6]);
    expect(r.compensationOk).toBe(true);
    expect(r.insufficientCount).toBe(5);
    expect(r.passed).toBe(false);
  });
  it('fails with a grade below 2', () => {
    const r = checkRules([1.5, 6, 6, 6, 6, 6]);
    expect(r.compensationOk).toBe(true);
    expect(r.minimumOk).toBe(false);
    expect(r.passed).toBe(false);
  });
  it('accepts exactly 4 insufficient grades and a 2', () => {
    expect(checkRules([2, 3.5, 3.5, 3.5, 6, 6, 6, 6, 6]).passed).toBe(true);
  });
});

describe('promotion', () => {
  it('ignores disciplines without grades and flags the result provisional', () => {
    const r = evaluatePromotion(choices, year(1, [test('francais', 5, 1), test('francais', 5, 2)]));
    expect(r.check.passed).toBe(true);
    expect(r.provisional).toBe(true);
    expect(r.missing.length).toBe(r.rows.length - 1);
  });
  it('does not include the OC in 1re', () => {
    const r = evaluatePromotion(choices, year(1));
    expect(r.rows.some((row) => row.discipline.id === 'oc')).toBe(false);
    expect(r.rows.some((row) => row.discipline.id === 'eps')).toBe(true);
  });
});

describe('curriculum', () => {
  it('gives science OS students more maths', () => {
    expect(disciplinesFor(choices, 1).find((d) => d.id === 'maths')!.hours).toBe(6);
    expect(disciplinesFor({ ...choices, os: 'espagnol' }, 1).find((d) => d.id === 'maths')!.hours).toBe(4);
  });
  it('knows when disciplines end', () => {
    expect(lastLevelTaught(choices, 'biologie')).toBe(2);
    expect(lastLevelTaught(choices, 'physique')).toBe(2);
    expect(lastLevelTaught({ ...choices, track: 'bilingue', bilingualExam: 'physique' }, 'physique')).toBe(3);
    expect(lastLevelTaught(choices, 'philosophie')).toBe(3);
  });
});

describe('choices', () => {
  it('excludes a DF language as OS', () => {
    expect(allowedOs({ l2: 'italien', l3: 'anglais' })).not.toContain('italien');
    expect(allowedOs({ l2: 'italien', l3: 'anglais' })).not.toContain('anglais');
    expect(allowedOs({ l2: 'allemand', l3: 'latin' })).toContain('anglais');
  });
  it('excludes OC incompatible with the OS', () => {
    expect(allowedOc({ os: 'pm' })).not.toContain('applications-maths');
    expect(allowedOc({ os: 'pm' })).not.toContain('physique');
    expect(allowedOc({ os: 'theatre' })).not.toContain('sport');
    expect(allowedOc({ os: 'espagnol' })).toHaveLength(13);
  });
  it('validates and normalizes', () => {
    const bad: Choices = { ...choices, os: 'arts-visuels', arts: 'arts-visuels', oc: 'musique' };
    expect(validateChoices(bad).length).toBe(2);
    const fixed = normalizeChoices(bad);
    expect(fixed.arts).toBe('musique');
    expect(validateChoices(fixed)).toEqual([]);
    expect(normalizeChoices({ ...choices, track: 'bilingue', l2: 'italien', l3: 'anglais' }).l2).toBe('allemand');
  });
});

describe('maturité', () => {
  it('averages school and exam grade, .25/.75 up', () => {
    expect(maturiteGrade(4.5, 4, true)).toBe(4.5); // 4.25 → 4.5
    expect(maturiteGrade(4.4, null, true)).toBeNull();
    expect(maturiteGrade(4.4, null, false)).toBe(4.5);
  });

  const full = (level: 1 | 2 | 3, grade: number, overrides: Record<string, number> = {}) => {
    const tests = disciplinesFor(choices, level).flatMap((d) => [test(d.id, grade, 1), test(d.id, grade, 2)]);
    return year(level, tests, overrides);
  };

  const profile = (years: SchoolYear[], exams: Record<string, number>, tm = 5): Profile => ({
    id: 'p',
    name: 'Test',
    choices,
    years,
    maturite: { exams, schoolOverrides: {}, tm },
    createdAt: '',
  });

  it('takes 2e grades for disciplines that end in 2e', () => {
    const p = profile([full(2, 5), full(3, 4)], { francais: 4, l2: 4, maths: 4, os: 4, oc: 4 });
    const r = evaluateMaturite(p);
    expect(r.rows.find((x) => x.id === 'biologie')!.final).toBe(5);
    expect(r.rows.find((x) => x.id === 'philosophie')!.final).toBe(4);
    expect(r.complete).toBe(true);
    expect(r.passed).toBe(true);
  });

  it('requires L1 + L2 + maths + OS ≥ 16', () => {
    const p = profile([full(2, 6), full(3, 4)], { francais: 3, l2: 3, maths: 3, os: 4, oc: 4 });
    const r = evaluateMaturite(p);
    // francais/l2/maths: (4+3)/2 = 3.5 → 3.5; os: 4 → sum 14.5
    expect(r.coreSum).toBe(14.5);
    expect(r.coreOk).toBe(false);
    expect(r.passed).toBe(false);
  });
});

describe('neededGrade', () => {
  it('computes the grade needed to reach a target', () => {
    // (3.5 + x)/2 ≥ 3.75 → x ≥ 4
    expect(neededGrade([test('f', 3.5)], 4)).toEqual({ status: 'reachable', needed: 4 });
    // weight 2: (3.5 + 2x)/3 ≥ 3.75 → x ≥ 3.875 → 3.9
    expect(neededGrade([test('f', 3.5)], 4, 2)).toEqual({ status: 'reachable', needed: 3.9 });
  });
  it('detects secured and impossible targets', () => {
    expect(neededGrade([test('f', 6), test('f', 6)], 4).status).toBe('secured');
    expect(neededGrade([test('f', 2), test('f', 2)], 5).status).toBe('impossible');
    expect(neededGrade([], 4)).toEqual({ status: 'reachable', needed: 3.8 });
  });
});

describe('composed grades', () => {
  const francais = disciplinesFor(choices, 1).find((d) => d.id === 'francais')!;
  const composed = (parts: [number, Semester][], weight = 1, rounding?: CompositeRounding): Test =>
    test('francais', 0, parts[0]?.[1] ?? 1, {
      weight,
      rounding,
      parts: parts.map(([grade, semester], i) => ({ id: `p${i}`, grade, semester })),
    });

  it('rounds to the tenth or the quarter, halves going up', () => {
    expect(roundTo(5.1666, 0.1)).toBe(5.2);
    expect(roundTo(5.15, 0.1)).toBe(5.2);
    expect(roundTo(5.1666, 0.25)).toBe(5.25);
    expect(roundTo(5.125, 0.25)).toBe(5.25);
    expect(roundTo(5.1, 0.25)).toBe(5);
  });

  it('is the equal-weight mean of its sub-grades, rounded as configured', () => {
    const parts: [number, Semester][] = [
      [5, 1],
      [4.5, 1],
      [6, 1],
    ];
    expect(compositeValue(composed(parts))).toBe(5.2); // tenth by default
    expect(compositeValue(composed(parts, 1, 'quarter'))).toBe(5.25);
    expect(compositeValue(composed(parts, 1, 'none'))).toBeCloseTo(5.1667, 3);
    expect(compositeValue(composed([]))).toBeNull();
  });

  it('counts once in the year average with its own weight', () => {
    // Composed 5, 4.5, 6 → 5.2 (weight 1); test 4 (weight 2) → (5.2 + 8) / 3 = 4.4
    const y = year(1, [
      composed([
        [5, 1],
        [4.5, 1],
        [6, 1],
      ]),
      test('francais', 4, 1, { weight: 2 }),
    ]);
    const a = annualResult(francais, y);
    expect(a.raw).toBeCloseTo(4.4);
    expect(a.value).toBe(4.5);
  });

  it('spans the year: all sub-grades for the year, each semester for its info average', () => {
    const y = year(1, [
      composed([
        [4, 1],
        [5, 2],
        [6, 2],
      ]),
      test('francais', 3, 1),
    ]);
    // year: composed (4 + 5 + 6) / 3 = 5 → (5 + 3) / 2 = 4
    expect(annualResult(francais, y).raw).toBe(4);
    // S1: composed 4, test 3 → 3.5; S2: composed 5.5 only
    expect(semesterResult(francais, y, 1).raw).toBe(3.5);
    expect(semesterResult(francais, y, 2).raw).toBe(5.5);
  });

  it('ignores an empty composed grade', () => {
    const y = year(1, [composed([]), test('francais', 5, 1)]);
    expect(annualResult(francais, y).raw).toBe(5);
  });

  it('is taken into account by the projection', () => {
    // composed 3.5 (weight 1) → (3.5 + x) / 2 ≥ 3.75 → x ≥ 4
    expect(
      neededGrade(
        [
          composed([
            [3, 1],
            [4, 1],
          ]),
        ],
        4,
      ),
    ).toEqual({ status: 'reachable', needed: 4 });
  });
});

describe('OC not chosen yet', () => {
  const { oc: _oc, ...noOc } = choices;

  it('leaves the OC out of the year until chosen', () => {
    expect(disciplinesFor(noOc, 2).some((d) => d.id === 'oc')).toBe(false);
    expect(disciplinesFor(choices, 2).some((d) => d.id === 'oc')).toBe(true);
  });

  it('is valid, and flagged once the student reaches the 2nd year', () => {
    expect(validateChoices(noOc)).toEqual([]);
    expect(ocMissing(noOc, [1])).toBe(false);
    expect(ocMissing(noOc, [1, 2])).toBe(true);
    expect(ocMissing(choices, [1, 2])).toBe(false);
  });

  it('keeps the maturité incomplete without an OC', () => {
    const p: Profile = {
      id: 'p',
      name: 'x',
      choices: noOc,
      years: [],
      maturite: { exams: {}, schoolOverrides: {} },
      createdAt: '',
    };
    const r = evaluateMaturite(p);
    expect(r.rows.some((row) => row.id === 'oc')).toBe(true);
    expect(r.complete).toBe(false);
  });

  it('drops an OC that becomes incompatible instead of picking another one', () => {
    expect(normalizeChoices({ ...choices, oc: 'biologie', os: 'bc' }).oc).toBeUndefined();
  });
});
