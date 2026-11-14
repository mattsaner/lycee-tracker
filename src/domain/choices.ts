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

export function allowedL3(c: Pick<Choices, 'l2'>): L3Id[] {
  return (Object.keys(L3_LABELS) as L3Id[]).filter((l3) => l3 !== c.l2);
}

export function allowedOs(c: Pick<Choices, 'l2' | 'l3'>): OsId[] {
  return (Object.keys(OS_LABELS) as OsId[]).filter((os) => {
    const lang = LANGUAGE_OS[os];
    return !lang || (lang !== c.l2 && lang !== c.l3);
  });
}

export function allowedOc(c: Pick<Choices, 'os'>): OcId[] {
  const excluded = OC_EXCLUDED_BY_OS[c.os] ?? [];
  return (Object.keys(OC_LABELS) as OcId[]).filter((oc) => !excluded.includes(oc));
}

export function validateChoices(c: Choices): string[] {
  const errors: string[] = [];
  if (c.track === 'bilingue' && c.l2 !== 'allemand') errors.push('La filière bilingue implique l’allemand en langue 2.');
  if (c.track === 'bilingue' && !c.bilingualExam)
    errors.push('Choisis la discipline examinée en allemand (physique ou histoire).');
  if (!allowedL3(c).includes(c.l3)) errors.push('La langue 3 doit être différente de la langue 2.');
  if (!allowedOs(c).includes(c.os))
    errors.push('Une langue étudiée en discipline fondamentale ne peut pas être choisie comme option spécifique.');
  if (c.os === 'arts-visuels' && c.arts !== 'musique')
    errors.push('L’option spécifique arts visuels implique la musique comme discipline artistique.');
  if (!allowedOc(c).includes(c.oc)) errors.push('Cette option complémentaire n’est pas compatible avec ton option spécifique.');
  return errors;
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
  if (!allowedOc(next).includes(next.oc)) next.oc = allowedOc(next)[0];
  return next;
}
