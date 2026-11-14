import { describe, expect, it } from 'vitest';
import { open, WrongPasswordError } from '../crypto/vault';
import { disciplinesFor } from '../data/curriculum';
import { annualResult } from '../domain/averages';
import type { Profile } from '../domain/types';
import { parseBackup, toBackup } from './backup';
import { loadEntries, loadPayload, MIGRATIONS, SCHEMA_VERSION, sanitizeProfiles } from './schema';
import { useStore } from './store';

/** Every exported format ever released; each must keep importing without loss. */
const fixtures = import.meta.glob<string>('./fixtures/*.json', { eager: true, query: '?raw', import: 'default' });
const FIXTURE_PASSWORD = 'fixture-password';

/** Checks the content shared by the fixtures (same profiles in every version). */
function expectFixtureProfile(p: Profile) {
  const year = p.years[0];
  const composite = year.tests.find((t) => t.id === 't4')!;
  expect(year.tests).toHaveLength(4);
  expect(composite.parts).toHaveLength(2);
  expect(composite.rounding).toBe('quarter');
  expect(year.overrides).toEqual({ maths: 4.5 });
  expect(p.maturite).toMatchObject({ exams: { francais: 4.5 }, schoolOverrides: { biologie: 5 }, tm: 5.5 });
  const francais = disciplinesFor(p.choices, 1).find((d) => d.id === 'francais')!;
  expect(annualResult(francais, year).raw).toBeCloseTo((4.5 + 5.25 * 2) / 3);
}

describe('data format', () => {
  it('has a migration for every past version and a fixture for each version', () => {
    for (let v = 1; v < SCHEMA_VERSION; v++) {
      expect(MIGRATIONS[v], `migration from v${v}`).toBeTypeOf('function');
      expect(Object.keys(fixtures)).toContain(`./fixtures/backup-v${v}.json`);
    }
    expect(Object.keys(fixtures)).toContain(`./fixtures/backup-v${SCHEMA_VERSION}.json`);
  });

  it.each(Object.entries(fixtures))('imports %s without warnings or loss', (_name, text) => {
    const { entries, warnings } = parseBackup(text);
    const raw = JSON.parse(text);
    expect(warnings).toEqual([]);
    expect(entries).toHaveLength((raw.entries ?? raw.profiles).length);
  });

  it('turns v1 plain profiles into entries that need a password', () => {
    const { entries } = parseBackup(fixtures['./fixtures/backup-v1.json']);
    expect(entries.every((e) => e.legacy && !e.sealed)).toBe(true);
    expectFixtureProfile(entries[0].legacy!);
    expect(entries[1].legacy!.choices.oc).toBeUndefined();
    expect(entries[1].legacy!.choices.bilingualExam).toBe('histoire');
  });

  it('decrypts v2 entries with the password, and only with it', async () => {
    const { entries } = parseBackup(fixtures['./fixtures/backup-v2.json']);
    const [sealed, legacy] = entries;
    expect(sealed.sealed).toBeDefined();
    expect(JSON.stringify(sealed)).not.toContain('Dissertation');
    const { value } = await open(sealed.sealed!, FIXTURE_PASSWORD);
    expectFixtureProfile(loadPayload(value, sealed.id));
    await expect(open(sealed.sealed!, 'not-the-password')).rejects.toBeInstanceOf(WrongPasswordError);
    expect(legacy.legacy?.name).toBe('Élève bilingue');
  });

  it('round-trips through export and import unchanged', () => {
    for (const text of Object.values(fixtures)) {
      const { entries } = parseBackup(text);
      expect(parseBackup(JSON.stringify(toBackup(entries))).entries).toEqual(entries);
    }
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
    const all = warnings.join(' ');
    expect(all).toMatch(/astronomie/);
    expect(all).toMatch(/cuisine/);
    expect(all).toMatch(/1 note\(s\) illisible/);
    expect(all).toMatch(/1 année\(s\) illisible/);
    expect(all).toMatch(/1 profil\(s\) illisible/);
  });

  it('skips unreadable v2 entries with a warning', () => {
    const { entries, warnings } = loadEntries(
      [{ id: 'a', name: 'A', sealed: { v: 1, kdf: 'other' } }, { id: 'b', name: 'B' }, 'x'],
      2,
    );
    expect(entries).toEqual([]);
    expect(warnings.join(' ')).toMatch(/3 profil\(s\) illisible/);
  });

  it('replaces unsafe or duplicate ids, since ids end up in URLs', () => {
    const profile = (id: string) => ({ id, name: 'X', choices: {}, years: [], maturite: {} });
    const { profiles } = sanitizeProfiles([profile('\\\\evil.example/x'), profile('ok-1'), profile('ok-1')]);
    expect(profiles[0].id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(profiles[0].id).not.toContain('evil');
    expect(profiles[1].id).toBe('ok-1');
    expect(profiles[2].id).not.toBe('ok-1');
  });

  it('rejects files it cannot understand', () => {
    expect(() => parseBackup('not json')).toThrow(/JSON/);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/pas une sauvegarde/);
    expect(() =>
      parseBackup(JSON.stringify({ app: 'lycee-tracker', schemaVersion: SCHEMA_VERSION + 1, entries: [] })),
    ).toThrow(/plus récente/);
    expect(() => loadEntries({}, SCHEMA_VERSION)).toThrow(/liste/);
  });

  it('loads browser data saved by the v1 release as entries to protect', async () => {
    const { profiles } = JSON.parse(fixtures['./fixtures/backup-v1.json']);
    // v1 storage, written before the backup reminder and passwords existed.
    localStorage.clear();
    localStorage.setItem('lycee-tracker', JSON.stringify({ state: { profiles }, version: 1 }));
    await useStore.persist.rehydrate();
    const state = useStore.getState();
    expect(state.vault).toHaveLength(2);
    expect(state.vault[0].legacy?.years[0].tests).toHaveLength(4);
    expect(state.profiles).toEqual([]);
    expect(state.backup.frequencyDays).toBe(7);
    expect(Object.keys(localStorage).some((k) => k.startsWith('lycee-tracker:pre-v1:'))).toBe(true);
  });

  it('keeps unreadable browser data aside instead of overwriting it', async () => {
    localStorage.clear();
    localStorage.setItem('lycee-tracker', JSON.stringify({ state: { vault: 'broken' }, version: SCHEMA_VERSION }));
    await useStore.persist.rehydrate();
    expect(Object.keys(localStorage).filter((k) => k.startsWith('lycee-tracker:unreadable:'))).toHaveLength(1);
  });
});
