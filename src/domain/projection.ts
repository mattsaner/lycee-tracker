import { weightedValues } from './averages';
import type { Test } from './types';

export type Projection =
  | { status: 'reachable'; needed: number }
  | { status: 'secured' }
  | { status: 'impossible'; needed: number };

/**
 * Grade needed on the next test (with the given weight) so that the annual
 * average rounds to at least `target`. A raw average of target − 0.25 rounds up to target.
 */
export function neededGrade(tests: Test[], target: number, weight = 1): Projection {
  const threshold = target - 0.25;
  const values = weightedValues(tests);
  const sum = values.reduce((s, v) => s + v.value * v.weight, 0);
  const total = values.reduce((s, v) => s + v.weight, 0);
  const needed = (threshold * (total + weight) - sum) / weight;
  if (needed <= 1) return { status: 'secured' };
  if (needed > 6) return { status: 'impossible', needed };
  // Round up to the tenth: the student must reach at least this grade.
  return { status: 'reachable', needed: Math.ceil(needed * 10 - 1e-9) / 10 };
}
