import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { disciplinesFor } from '../../data/curriculum';
import type { Semester } from '../../domain/types';
import type { ProfileContext } from '../profile/ProfileLayout';
import { DisciplineCard } from './DisciplineCard';

export function YearNotes() {
  const { profile, year } = useOutletContext<ProfileContext>();
  const [semester, setSemester] = useState<Semester>(() => (new Date().getMonth() >= 1 && new Date().getMonth() < 7 ? 2 : 1));

  if (!year) return <p>Année introuvable.</p>;
  const disciplines = disciplinesFor(profile.choices, year.level);

  return (
    <>
      <div className="segmented semester-switch">
        {([1, 2] as Semester[]).map((s) => (
          <label key={s} className={semester === s ? 'active' : ''}>
            <input type="radio" name="semester" checked={semester === s} onChange={() => setSemester(s)} />
            {s === 1 ? '1er semestre' : '2e semestre'}
          </label>
        ))}
      </div>
      <div className="discipline-list">
        {disciplines.map((d) => (
          <DisciplineCard key={d.id} profileId={profile.id} year={year} discipline={d} semester={semester} />
        ))}
      </div>
    </>
  );
}
