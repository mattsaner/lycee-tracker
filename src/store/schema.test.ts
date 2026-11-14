import { describe, expect, it } from 'vitest';
import { annualResult } from '../domain/averages';
import { disciplinesFor } from '../data/curriculum';
import { parseBackup, toBackup } from './backup';
import { loadProfiles, MIGRATIONS, SCHEMA_VERSION, sanitizeProfiles } from './schema';
import { useStore } from './store';

/** Every exported format ever released; each must keep importing without loss. */
const fixtures = import.meta.glob<string>('./fixtures/*.json', { eager: true, query: '?raw', import: 'default' });

describe('data format', () => {
  it('has a migration for every past version and a fixture for the current one', () => {
    for (let v = 1; v < SCHEMA_VERSION; v++) expect(MIGRATIONS[v], `migration from v${v}`).toBeTypeOf('function');
    expect(Object.keys(fixtures)).toContain(`./fixtures/backup-v${SCHEMA_VERSION}.json`);
  });

  it.each(Object.entries(fixtures))('imports %s without warnings or loss', (_name, text) => {
    const { profiles, warnings } = parseBackup(text);
    const raw = JSON.parse(text).profiles;
    expect(warnings).toEqual([]);
    expect(profiles).toHaveLength(raw.length);
    profiles.forEach((p, i) => {
      expect(p.years).toHaveLength(raw[i].years.length);
      p.years.forEach((y, j) => expect(y.tests).toHaveLength(raw[i].years[j].tests.length));
    });
  });

  it('keeps grades, composed grades, overrides and maturité data of v1', () => {
    const { profiles } = parseBackup(fixtures['./fixtures/backup-v1.json']);
    const [p, bilingual] = profiles;
    const year = p.years[0];
    const composite = year.tests.find((t) => t.id === 't4')!;
    expect(composite.parts).toHaveLength(2);
    expect(composite.rounding).toBe('quarter');
    expect(year.overrides).toEqual({ maths: 4.5 });
    expect(p.maturite).toMatchObject({ exams: { francais: 4.5 }, schoolOverrides: { biologie: 5 }, tm: 5.5 });
    const francais = disciplinesFor(p.choices, 1).find((d) => d.id === 'francais')!;
    expect(annualResult(francais, year).raw).toBeCloseTo((4.5 + 5.25 * 2) / 3);
    // OC not chosen yet stays undefined
    expect(bilingual.choices.oc).toBeUndefined();
    expect(bilingual.choices.bilingualExam).toBe('histoire');
  });

  it('round-trips through export and import unchanged', () => {
    const { profiles } = parseBackup(fixtures['./fixtures/backup-v1.json']);
    expect(parseBackup(JSON.stringify(toBackup(profiles))).profiles).toEqual(profiles);
  });

  it('repairs instead of rejecting, and reports what it changed', () => {
    const { profiles, warnings } = sanitizeProfiles([
      {
        name: 'Abc',
        futureField: 'kept',
        choices: { track: 'standard', l2: 'allemand', l3: 'anglais', arts: 'musique', os: 'astronomie', oc: 'cuisine' },
        years: [
          {
            level: 1,
            tests: [
              { disciplineId: 'francais', semester: 1, grade: 5 }, // no id, no weight
              { disciplineId: 'francais', semester: 1, grade: 9, weight: 1 }, // invalid grade
              {
                disciplineId: 'l2',
                semester: 2,
                parts: [
                  { grade: 4, semester: 2 },
                  { grade: 'x', semester: 1 },
                ],
              },
            ],
          },
          { level: 7, tests: [] },
        ],
      },
      'garbage',
    ]);
    expect(profiles).toHaveLength(1);
    const p = profiles[0];
    expect((p as unknown as { futureField: string }).futureField).toBe('kept');
    expect(p.choices.os).toBe('espagnol');
    expect(p.choices.oc).toBeUndefined();
    expect(p.years).toHaveLength(1);
    expect(p.years[0].tests).toHaveLength(2);
    expect(p.years[0].tests[0].weight).toBe(1);
    expect(p.years[0].tests[0].id).toBeTruthy();
    expect(p.years[0].tests[1].parts).toHaveLength(1);
    expect(p.maturite).toEqual({ exams: {}, schoolOverrides: {}, tm: undefined });
    expect(warnings.join(' ')).toMatch(/astronomie/);
    expect(warnings.join(' ')).toMatch(/cuisine/);
    expect(warnings.join(' ')).toMatch(/1 note\(s\) illisible/);
    expect(warnings.join(' ')).toMatch(/1 année\(s\) illisible/);
    expect(warnings.join(' ')).toMatch(/1 profil\(s\) illisible/);
  });

  it('rejects files it cannot understand', () => {
    expect(() => parseBackup('not json')).toThrow(/JSON/);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/pas une sauvegarde/);
    expect(() =>
      parseBackup(JSON.stringify({ app: 'lycee-tracker', schemaVersion: SCHEMA_VERSION + 1, profiles: [] })),
    ).toThrow(/plus récente/);
    expect(() => loadProfiles({}, SCHEMA_VERSION)).toThrow(/liste/);
  });

  it('loads browser data saved by an earlier release', async () => {
    const { profiles } = JSON.parse(fixtures['./fixtures/backup-v1.json']);
    // v1 storage written before the backup reminder existed: no `backup` key.
    localStorage.setItem('lycee-tracker', JSON.stringify({ state: { profiles }, version: 1 }));
    await useStore.persist.rehydrate();
    const state = useStore.getState();
    expect(state.profiles).toHaveLength(2);
    expect(state.profiles[0].years[0].tests).toHaveLength(4);
    expect(state.backup.frequencyDays).toBe(7);
  });

  it('keeps unreadable browser data aside instead of overwriting it', async () => {
    localStorage.clear();
    localStorage.setItem('lycee-tracker', JSON.stringify({ state: { profiles: 'broken' }, version: 1 }));
    await useStore.persist.rehydrate();
    const saved = Object.keys(localStorage).filter((k) => k.startsWith('lycee-tracker:unreadable:'));
    expect(saved).toHaveLength(1);
  });
});
