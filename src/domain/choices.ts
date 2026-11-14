/** Choice rules of RSJU 412.311.1 art. 10 and of the Lycée enrolment brochure. */
import { L3_LABELS, OC_LABELS, OS_LABELS } from '../data/curriculum';
import type { Choices, L3Id, OcId, OsId } from './types';

const LANGUAGE_OS: Partial<Record<OsId, string>> = { italien: 'italien', anglais: 'anglais' };

/** OC excluded by each OS: same subject (rule 4), science OS (rule 6), arts OS (rule 9). */
const OC_EXCLUDED_BY_OS: Partial<Record<OsId, OcId[]>> = {
  pm: ['applications-maths', 'physique'],
  bc: ['applications-maths', 'biologie', 'chimie'],
  'economie-droit': ['economie-droit'],
  'arts-visuels': ['arts-visuels', 'musique', 'theatre', 'sport'],
  theatre: ['theatre', 'arts-visuels', 'musique', 'sport'],
};

/** Why a langue 3 cannot be chosen, or null when it can. */
export function l3BlockReason(c: Pick<Choices, 'l2'>, l3: L3Id): string | null {
  return l3 === c.l2 ? 'déjà en langue 2' : null;
}

/** Why an option spécifique cannot be chosen, or null when it can. */
export function osBlockReason(c: Pick<Choices, 'l2' | 'l3'>, os: OsId): string | null {
  const lang = LANGUAGE_OS[os];
  if (lang && lang === c.l3) return 'déjà en langue 3';
  if (lang && lang === c.l2) return 'déjà en langue 2';
  return null;
}

/** Why an option complémentaire cannot be chosen, or null when it can. */
export function ocBlockReason(c: Pick<Choices, 'os'>, oc: OcId): string | null {
  return OC_EXCLUDED_BY_OS[c.os]?.includes(oc) ? 'incompatible avec ton OS' : null;
}

export function allowedL3(c: Pick<Choices, 'l2'>): L3Id[] {
  return (Object.keys(L3_LABELS) as L3Id[]).filter((l3) => !l3BlockReason(c, l3));
}

export function allowedOs(c: Pick<Choices, 'l2' | 'l3'>): OsId[] {
  return (Object.keys(OS_LABELS) as OsId[]).filter((os) => !osBlockReason(c, os));
}

export function allowedOc(c: Pick<Choices, 'os'>): OcId[] {
  return (Object.keys(OC_LABELS) as OcId[]).filter((oc) => !ocBlockReason(c, oc));
}

export function validateChoices(c: Choices): string[] {
  const errors: string[] = [];
  if (c.track === 'bilingue' && c.l2 !== 'allemand')
    errors.push('La filière bilingue implique l’allemand en langue 2.');
  if (c.track === 'bilingue' && !c.bilingualExam)
    errors.push('Choisis la discipline examinée en allemand (physique ou histoire).');
  if (!allowedL3(c).includes(c.l3)) errors.push('La langue 3 doit être différente de la langue 2.');
  if (!allowedOs(c).includes(c.os))
    errors.push('Une langue étudiée en discipline fondamentale ne peut pas être choisie comme option spécifique.');
  if (c.os === 'arts-visuels' && c.arts !== 'musique')
    errors.push('L’option spécifique arts visuels implique la musique comme discipline artistique.');
  if (c.oc && !allowedOc(c).includes(c.oc))
    errors.push('Cette option complémentaire n’est pas compatible avec ton option spécifique.');
  return errors;
}

/** True when the profile reached the 2nd year without choosing its OC. */
export function ocMissing(c: Choices, levels: number[]): boolean {
  return c.oc === undefined && levels.some((l) => l >= 2);
}

/** Brings a set of choices back to a valid state after one field changed. */
export function normalizeChoices(c: Choices): Choices {
  const next = { ...c };
  if (next.track === 'bilingue') {
    next.l2 = 'allemand';
    next.bilingualExam ??= 'physique';
  } else {
    delete next.bilingualExam;
  }
  if (!allowedL3(next).includes(next.l3)) next.l3 = allowedL3(next)[0];
  if (!allowedOs(next).includes(next.os)) next.os = allowedOs(next)[0];
  if (next.os === 'arts-visuels') next.arts = 'musique';
  if (next.oc && !allowedOc(next).includes(next.oc)) delete next.oc;
  return next;
}
