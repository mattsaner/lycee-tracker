import { disciplinesFor } from '../data/curriculum';
import { annualResult, type AnnualResult } from './averages';
import { checkRules, type RuleCheck } from './rules';
import type { Choices, Discipline, SchoolYear } from './types';

export interface PromotionRow {
  discipline: Discipline;
  annual: AnnualResult;
}

export interface PromotionResult {
  rows: PromotionRow[];
  check: RuleCheck;
  /** Disciplines without any grade yet; the verdict ignores them. */
  missing: Discipline[];
  /** True when some disciplines are missing or only one semester is graded. */
  provisional: boolean;
}

/** Annual promotion based on every discipline taught in the year (art. 30–31). */
export function evaluatePromotion(choices: Choices, year: SchoolYear): PromotionResult {
  const rows = disciplinesFor(choices, year.level).map((discipline) => ({
    discipline,
    annual: annualResult(discipline, year),
  }));
  const graded = rows.filter((r) => r.annual.value !== null);
  const missing = rows.filter((r) => r.annual.value === null).map((r) => r.discipline);
  return {
    rows,
    check: checkRules(graded.map((r) => r.annual.value as number)),
    missing,
    provisional: missing.length > 0 || graded.some((r) => r.annual.provisional),
  };
}
