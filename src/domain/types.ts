export type Level = 1 | 2 | 3;
export type Semester = 1 | 2;

export type Track = 'standard' | 'bilingue';
export type L2Id = 'allemand' | 'italien';
export type L3Id = 'anglais' | 'italien' | 'latin' | 'grec';
export type ArtsId = 'arts-visuels' | 'musique';
export type OsId =
  | 'italien'
  | 'anglais'
  | 'espagnol'
  | 'pm'
  | 'bc'
  | 'economie-droit'
  | 'arts-visuels'
  | 'theatre';
export type OcId =
  | 'applications-maths'
  | 'informatique'
  | 'physique'
  | 'chimie'
  | 'biologie'
  | 'histoire'
  | 'geographie'
  | 'economie-droit'
  | 'sciences-religions'
  | 'arts-visuels'
  | 'musique'
  | 'theatre'
  | 'sport';
export type BilingualExam = 'physique' | 'histoire';

/** Choices made at enrolment; they define the set of disciplines. */
export interface Choices {
  track: Track;
  l2: L2Id;
  l3: L3Id;
  arts: ArtsId;
  os: OsId;
  oc: OcId;
  /** Bilingual track only: discipline examined in German instead of the OC. */
  bilingualExam?: BilingualExam;
}

export interface Test {
  id: string;
  disciplineId: string;
  /** Only for disciplines made of several branches (OS PM / BC). */
  branchId?: string;
  semester: Semester;
  grade: number;
  weight: number;
  label?: string;
  date?: string;
}

export interface SchoolYear {
  id: string;
  level: Level;
  /** Calendar label, e.g. "2025-2026". */
  label: string;
  tests: Test[];
  /** Official bulletin grades entered by the student, keyed by `${disciplineId}:${semester}`. */
  overrides: Record<string, number>;
}

export interface MaturiteInput {
  /** Exam grades keyed by disciplineId. */
  exams: Record<string, number>;
  /** Manual school grades (when earlier years were not tracked), keyed by disciplineId. */
  schoolOverrides: Record<string, number>;
  /** Travail de maturité grade. */
  tm?: number;
}

export interface Profile {
  id: string;
  name: string;
  choices: Choices;
  years: SchoolYear[];
  maturite: MaturiteInput;
  createdAt: string;
}

export type DisciplineKind = 'DF' | 'OS' | 'OC' | 'EPS';

export interface Branch {
  id: string;
  name: string;
  weight: number;
}

export interface Discipline {
  id: string;
  name: string;
  kind: DisciplineKind;
  /** Weekly lessons for the level. */
  hours: number;
  branches?: Branch[];
  /** Role in the maturité: with exam, school grade only, or not a maturité discipline. */
  maturite: 'exam' | 'school' | null;
}
