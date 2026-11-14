import { beforeEach, describe, expect, it } from 'vitest';
import type { Choices } from '../domain/types';
import { reminderDueDays, useStore } from './store';

const DAY = 24 * 60 * 60 * 1000;
const choices: Choices = {
  track: 'standard',
  l2: 'allemand',
  l3: 'anglais',
  arts: 'musique',
  os: 'bc',
  oc: 'histoire',
};
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

describe('backup reminder', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState({ profiles: [], backup: { frequencyDays: 7 } });
  });

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

  it('starts the unsaved period on the first change and clears it on export', () => {
    const { addProfile, addTest, markExported } = useStore.getState();
    const p = addProfile('Léa', choices, 1, '2025-2026');
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

  it('persists the reminder settings with the profiles', () => {
    useStore.getState().setReminderFrequency(30);
    const saved = JSON.parse(localStorage.getItem('lycee-tracker')!);
    expect(saved.state.backup.frequencyDays).toBe(30);
  });
});
