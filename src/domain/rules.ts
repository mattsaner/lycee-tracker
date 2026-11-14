/**
 * Pass rules shared by annual promotion (RSJU 412.311.1 art. 31) and the maturité
 * (RSJU 412.351 art. 16a):
 * 1. double compensation: 2 × Σ(4 − n) for n < 4 must not exceed Σ(n − 4) for n > 4;
 * 2. at most 4 grades below 4;
 * 3. no grade below 2.
 */
export interface RuleCheck {
  /** Σ(4 − n) over insufficient grades. */
  deficit: number;
  /** Σ(n − 4) over grades above 4. */
  surplus: number;
  /** surplus − 2 × deficit; negative means the compensation fails. */
  margin: number;
  insufficientCount: number;
  lowest: number | null;
  compensationOk: boolean;
  countOk: boolean;
  minimumOk: boolean;
  passed: boolean;
}

const EPS = 1e-9;
export const PASS_GRADE = 4;
export const MAX_INSUFFICIENT = 4;
export const MIN_GRADE = 2;

export function checkRules(grades: number[]): RuleCheck {
  let deficit = 0;
  let surplus = 0;
  let insufficientCount = 0;
  for (const g of grades) {
    if (g < PASS_GRADE - EPS) {
      deficit += PASS_GRADE - g;
      insufficientCount++;
    } else {
      surplus += g - PASS_GRADE;
    }
  }
  const lowest = grades.length ? Math.min(...grades) : null;
  const margin = surplus - 2 * deficit;
  const compensationOk = margin >= -EPS;
  const countOk = insufficientCount <= MAX_INSUFFICIENT;
  const minimumOk = lowest === null || lowest >= MIN_GRADE - EPS;
  return {
    deficit,
    surplus,
    margin,
    insufficientCount,
    lowest,
    compensationOk,
    countOk,
    minimumOk,
    passed: compensationOk && countOk && minimumOk,
  };
}
