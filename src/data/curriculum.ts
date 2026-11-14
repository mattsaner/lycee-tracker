/**
 * Curriculum of the Lycée cantonal de Porrentruy (maturité gymnasiale, 3 years).
 *
 * Sources:
 * - Grille horaire: https://www.lycee.ch/images/documents/grille-horaire-def.pdf
 * - Règlement concernant l'organisation des études au Lycée cantonal (RSJU 412.311.1)
 * - Ordonnance concernant les examens de la maturité gymnasiale (RSJU 412.351)
 *
 * If the school changes its grid, this is the only file to update.
 */
import type {
  ArtsId,
  BilingualExam,
  Branch,
  Choices,
  Discipline,
  L2Id,
  L3Id,
  Level,
  OcId,
  OsId,
} from '../domain/types';

type Hours = readonly [number, number, number];

export const L2_LABELS: Record<L2Id, string> = {
  allemand: 'Allemand',
  italien: 'Italien',
};

export const L3_LABELS: Record<L3Id, string> = {
  anglais: 'Anglais',
  italien: 'Italien',
  latin: 'Latin',
  grec: 'Grec',
};

export const ARTS_LABELS: Record<ArtsId, string> = {
  'arts-visuels': 'Arts visuels',
  musique: 'Musique',
};

export const OS_LABELS: Record<OsId, string> = {
  italien: 'Italien',
  anglais: 'Anglais',
  espagnol: 'Espagnol',
  pm: 'Physique et applications des mathématiques',
  bc: 'Biologie et chimie',
  'economie-droit': 'Économie et droit',
  'arts-visuels': 'Arts visuels',
  theatre: 'Théâtre',
};

export const OC_LABELS: Record<OcId, string> = {
  'applications-maths': 'Applications des mathématiques',
  informatique: 'Informatique',
  physique: 'Physique',
  chimie: 'Chimie',
  biologie: 'Biologie',
  histoire: 'Histoire',
  geographie: 'Géographie',
  'economie-droit': 'Économie et droit',
  'sciences-religions': 'Science des religions',
  'arts-visuels': 'Arts visuels',
  musique: 'Musique',
  theatre: 'Théâtre',
  sport: 'Sport',
};

export const BILINGUAL_EXAM_LABELS: Record<BilingualExam, string> = {
  physique: 'Physique',
  histoire: 'Histoire',
};

export const LEVEL_LABELS: Record<Level, string> = {
  1: '1re année',
  2: '2e année',
  3: '3e année',
};

/**
 * Branches of the scientific OS. The semester grade of the OS is the mean of the
 * branch grades weighted by their weekly lessons (art. 29 al. 4). The grid does not
 * publish the split, so both branches weigh the same until the school confirms it.
 */
const OS_BRANCHES: Partial<Record<OsId, Branch[]>> = {
  pm: [
    { id: 'physique', name: 'Physique', weight: 1 },
    { id: 'applications-maths', name: 'Applications des mathématiques', weight: 1 },
  ],
  bc: [
    { id: 'biologie', name: 'Biologie', weight: 1 },
    { id: 'chimie', name: 'Chimie', weight: 1 },
  ],
};

export function isScienceOs(os: OsId): boolean {
  return os === 'pm' || os === 'bc';
}

interface DisciplineSpec {
  id: string;
  name: (c: Choices) => string;
  kind: Discipline['kind'];
  hours: (c: Choices) => Hours;
  maturite: (c: Choices) => Discipline['maturite'];
  branches?: (c: Choices) => Branch[] | undefined;
}

const bilingual = (c: Choices) => c.track === 'bilingue';

const SPECS: DisciplineSpec[] = [
  { id: 'francais', name: () => 'Français', kind: 'DF', hours: () => [4, 4, 5], maturite: () => 'exam' },
  {
    id: 'l2',
    name: (c) => L2_LABELS[c.l2],
    kind: 'DF',
    hours: (c) => (bilingual(c) ? [3, 3, 4] : [3, 3, 5]),
    maturite: () => 'exam',
  },
  { id: 'l3', name: (c) => L3_LABELS[c.l3], kind: 'DF', hours: () => [3, 3, 4], maturite: () => 'school' },
  {
    id: 'maths',
    name: () => 'Mathématiques',
    kind: 'DF',
    hours: (c) => (isScienceOs(c.os) ? [6, 4, 6] : [4, 4, 4]),
    maturite: () => 'exam',
  },
  { id: 'informatique', name: () => 'Informatique', kind: 'DF', hours: () => [2, 1, 0], maturite: () => null },
  {
    id: 'physique',
    name: () => 'Physique',
    kind: 'DF',
    hours: (c) => (bilingual(c) ? [2, 2, 1] : [2, 2, 0]),
    maturite: (c) => (bilingual(c) && c.bilingualExam === 'physique' ? 'exam' : 'school'),
  },
  { id: 'biologie', name: () => 'Biologie', kind: 'DF', hours: () => [2, 2, 0], maturite: () => 'school' },
  { id: 'chimie', name: () => 'Chimie', kind: 'DF', hours: () => [2, 2, 0], maturite: () => 'school' },
  {
    id: 'histoire',
    name: () => 'Histoire',
    kind: 'DF',
    hours: (c) => (bilingual(c) ? [0, 2, 3] : [1, 2, 2]),
    maturite: (c) => (bilingual(c) && c.bilingualExam === 'histoire' ? 'exam' : 'school'),
  },
  { id: 'geographie', name: () => 'Géographie', kind: 'DF', hours: () => [2, 2, 0], maturite: () => 'school' },
  {
    id: 'economie-droit',
    name: () => 'Économie et droit',
    kind: 'DF',
    hours: () => [2, 0, 0],
    maturite: () => null,
  },
  { id: 'philosophie', name: () => 'Philosophie', kind: 'DF', hours: () => [0, 0, 2], maturite: () => 'school' },
  { id: 'arts', name: (c) => ARTS_LABELS[c.arts], kind: 'DF', hours: () => [2, 3, 0], maturite: () => 'school' },
  {
    id: 'os',
    name: (c) => `OS ${OS_LABELS[c.os]}`,
    kind: 'OS',
    hours: (c) => (c.os === 'bc' ? [4, 4, 5] : c.os === 'pm' ? [2, 4, 6] : [4, 4, 6]),
    maturite: () => 'exam',
    branches: (c) => OS_BRANCHES[c.os],
  },
  {
    id: 'oc',
    name: (c) => (c.oc ? `OC ${OC_LABELS[c.oc]}` : 'OC (à choisir)'),
    kind: 'OC',
    hours: () => [0, 2, 2],
    // Bilingual students are examined in physique or histoire instead of the OC (412.351 art. 8 al. 1bis).
    maturite: (c) => (bilingual(c) ? 'school' : 'exam'),
  },
  {
    id: 'eps',
    name: () => 'Éducation physique et sportive',
    kind: 'EPS',
    hours: () => [2, 2, 2],
    maturite: () => null,
  },
];

function build(spec: DisciplineSpec, c: Choices, level: Level): Discipline {
  return {
    id: spec.id,
    name: spec.name(c),
    kind: spec.kind,
    hours: spec.hours(c)[level - 1],
    maturite: spec.maturite(c),
    branches: spec.branches?.(c),
  };
}

/**
 * Disciplines taught in the given year (weekly lessons > 0). All of them count for promotion (art. 14, 30).
 * The OC is left out until it is chosen.
 */
export function disciplinesFor(c: Choices, level: Level): Discipline[] {
  return SPECS.map((s) => build(s, c, level)).filter((d) => d.hours > 0 && (d.id !== 'oc' || c.oc !== undefined));
}

/**
 * Every discipline of the profile, with its maturité role, independent of the year. An OC not chosen
 * yet stays in the list so the maturité shows it as missing.
 */
export function allDisciplines(c: Choices): Discipline[] {
  return SPECS.map((s) => build(s, c, 3));
}

/** Last year in which a discipline is taught; its grades give the maturité school grade (412.351 art. 14 al. 3). */
export function lastLevelTaught(c: Choices, disciplineId: string): Level | null {
  const spec = SPECS.find((s) => s.id === disciplineId);
  if (!spec) return null;
  const hours = spec.hours(c);
  for (let i = 2; i >= 0; i--) if (hours[i] > 0) return (i + 1) as Level;
  return null;
}

/** Disciplines whose maturité grades must sum to at least 16 (412.351 art. 16a let. d). */
export const CORE_MATURITE_DISCIPLINES = ['francais', 'l2', 'maths', 'os'];
