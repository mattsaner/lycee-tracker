import { beforeEach, describe, expect, it } from 'vitest';
import { WrongPasswordError } from '../crypto/vault';
import type { Choices, Profile } from '../domain/types';
import { flushVault, reminderDueDays, useStore } from './store';

const DAY = 24 * 60 * 60 * 1000;
const PASSWORD = 'secret-password';
const choices: Choices = {
  track: 'standard',
  l2: 'allemand',
  l3: 'anglais',
  arts: 'musique',
  os: 'bc',
  oc: 'histoire',
};
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const stored = () => localStorage.getItem('lycee-tracker') ?? '';

beforeEach(() => {
  localStorage.clear();
  useStore.setState({ vault: [], profiles: [], backup: { frequencyDays: 7 } });
});

describe('encrypted profiles', () => {
  it('stores only encrypted data, never the grades in clear', async () => {
    const { createProfile, addTest } = useStore.getState();
    const p = await createProfile('Léa', choices, 1, '2025-2026', PASSWORD);
    addTest(p.id, p.years[0].id, {
      disciplineId: 'francais',
      semester: 1,
      grade: 5.5,
      weight: 1,
      label: 'Dissertation',
    });
    await flushVault();
    expect(useStore.getState().vault[0].sealed).toBeDefined();
    expect(stored()).toContain('Léa'); // the name stays readable to list profiles
    expect(stored()).not.toContain('Dissertation');
    expect(stored()).not.toContain('francais');
  });

  it('locks, refuses a wrong password and unlocks with the right one', async () => {
    const { createProfile, addTest, lock, unlock } = useStore.getState();
    const p = await createProfile('Léa', choices, 1, '2025-2026', PASSWORD);
    addTest(p.id, p.years[0].id, { disciplineId: 'francais', semester: 1, grade: 5.5, weight: 1 });
    await flushVault();

    lock(p.id);
    expect(useStore.getState().profiles).toEqual([]);
    await expect(unlock(p.id, 'wrong-password')).rejects.toBeInstanceOf(WrongPasswordError);
    expect(useStore.getState().profiles).toEqual([]);

    await unlock(p.id, PASSWORD);
    expect(useStore.getState().profiles[0].years[0].tests[0].grade).toBe(5.5);
  });

  it('changes the password', async () => {
    const { createProfile, changePassword, lock, unlock } = useStore.getState();
    const p = await createProfile('Léa', choices, 1, '2025-2026', PASSWORD);
    await expect(changePassword(p.id, 'wrong-password', 'new-password')).rejects.toBeInstanceOf(WrongPasswordError);
    await changePassword(p.id, PASSWORD, 'new-password');
    lock(p.id);
    await expect(unlock(p.id, PASSWORD)).rejects.toBeInstanceOf(WrongPasswordError);
    await unlock(p.id, 'new-password');
    expect(useStore.getState().profiles).toHaveLength(1);
  });

  it('protects a profile saved before passwords existed', async () => {
    const legacy: Profile = {
      id: 'old',
      name: 'Old',
      choices,
      years: [{ id: 'y', level: 1, label: '2024-2025', tests: [], overrides: {} }],
      maturite: { exams: {}, schoolOverrides: {} },
      createdAt: '',
    };
    useStore.setState({ vault: [{ id: 'old', name: 'Old', createdAt: '', legacy }] });
    await useStore.getState().protectLegacy('old', 'brand-new-pw');
    const entry = useStore.getState().vault[0];
    expect(entry.legacy).toBeUndefined();
    expect(entry.sealed).toBeDefined();
    expect(useStore.getState().profiles[0]).toEqual(legacy);
  });

  it('imports entries locked, replacing the same profile', async () => {
    const p = await useStore.getState().createProfile('Léa', choices, 1, '2025-2026', PASSWORD);
    const entry = useStore.getState().vault[0];
    useStore.getState().importEntries([{ ...entry, name: 'Léa (importé)' }]);
    expect(useStore.getState().vault).toHaveLength(1);
    expect(useStore.getState().vault[0].name).toBe('Léa (importé)');
    expect(useStore.getState().profiles.some((x) => x.id === p.id)).toBe(false);
  });
});

describe('backup reminder', () => {
  it('is due once unsaved changes are older than the interval', () => {
    expect(reminderDueDays({ frequencyDays: 7, unsavedSince: ago(6) })).toBeNull();
    expect(reminderDueDays({ frequencyDays: 7, unsavedSince: ago(8) })).toBe(8);
  });

  it('is not due without unsaved changes, when disabled or snoozed', () => {
    expect(reminderDueDays({ frequencyDays: 7 })).toBeNull();
    expect(reminderDueDays({ frequencyDays: 0, unsavedSince: ago(30) })).toBeNull();
    expect(
      reminderDueDays({
        frequencyDays: 7,
        unsavedSince: ago(30),
        snoozedUntil: new Date(Date.now() + DAY).toISOString(),
      }),
    ).toBeNull();
    expect(reminderDueDays({ frequencyDays: 7, unsavedSince: ago(30), snoozedUntil: ago(1) })).toBe(30);
  });

  it('starts the unsaved period on the first change and clears it on export', async () => {
    const { createProfile, addTest, markExported } = useStore.getState();
    const p = await createProfile('Léa', choices, 1, '2025-2026', PASSWORD);
    const first = useStore.getState().backup.unsavedSince;
    expect(first).toBeDefined();

    addTest(p.id, p.years[0].id, { disciplineId: 'francais', semester: 1, grade: 5, weight: 1 });
    expect(useStore.getState().backup.unsavedSince).toBe(first);

    markExported();
    expect(useStore.getState().backup.unsavedSince).toBeUndefined();
    expect(useStore.getState().backup.lastExportAt).toBeDefined();

    useStore.getState().deleteProfile(p.id);
    expect(useStore.getState().backup.unsavedSince).toBeDefined();
  });

  it('persists the reminder settings with the vault', () => {
    useStore.getState().setReminderFrequency(30);
    expect(JSON.parse(stored()).state.backup.frequencyDays).toBe(30);
  });
});
