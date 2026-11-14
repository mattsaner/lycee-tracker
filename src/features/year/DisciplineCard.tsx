import { useState, type FormEvent } from 'react';
import { annualResult, branchOf, overrideKey, testsFor } from '../../domain/averages';
import { neededGrade } from '../../domain/projection';
import type { Discipline, SchoolYear, Semester } from '../../domain/types';
import { useStore } from '../../store/store';
import { fmt, isValidGrade, parseNumber } from '../../ui/format';
import { GradeBadge, GradeField } from '../../ui/GradeField';

interface Props {
  profileId: string;
  year: SchoolYear;
  discipline: Discipline;
  semester: Semester;
}

const TARGETS = [4, 4.5, 5, 5.5, 6];

export function DisciplineCard({ profileId, year, discipline, semester }: Props) {
  const addTest = useStore((s) => s.addTest);
  const updateTest = useStore((s) => s.updateTest);
  const deleteTest = useStore((s) => s.deleteTest);
  const setOverride = useStore((s) => s.setOverride);

  const [grade, setGrade] = useState('');
  const [weight, setWeight] = useState('1');
  const [label, setLabel] = useState('');
  const [branchId, setBranchId] = useState(discipline.branches?.[0].id);
  const [target, setTarget] = useState(4);
  const [error, setError] = useState('');

  const annual = annualResult(discipline, year);
  const semesterInfo = semester === 1 ? annual.s1 : annual.s2;
  const tests = testsFor(year, discipline.id, semester);
  const branchName = (id?: string) => discipline.branches?.find((b) => b.id === id)?.name;

  // The annual grade uses every test of the year, so the projection does too.
  const yearTests = testsFor(year, discipline.id);
  const projectionTests = discipline.branches ? yearTests.filter((t) => branchOf(discipline, t) === branchId) : yearTests;
  const nextWeight = parseNumber(weight);
  const projection = neededGrade(projectionTests, target, nextWeight && nextWeight > 0 ? nextWeight : 1);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const g = parseNumber(grade);
    const w = parseNumber(weight);
    if (!isValidGrade(g)) return setError('La note doit être entre 1 et 6.');
    if (w === undefined || Number.isNaN(w) || w <= 0) return setError('Le poids doit être positif.');
    addTest(profileId, year.id, {
      disciplineId: discipline.id,
      branchId,
      semester,
      grade: g,
      weight: w,
      label: label.trim() || undefined,
      date: new Date().toISOString().slice(0, 10),
    });
    setGrade('');
    setLabel('');
    setWeight('1');
    setError('');
  };

  return (
    <details className="card discipline">
      <summary>
        <span className="discipline-name">
          {discipline.name}
          <small className="muted"> · {discipline.hours} h</small>
        </span>
        <span className="discipline-grades">
          {semesterInfo.raw !== null && (
            <small className="muted" title="Moyenne du semestre, à titre indicatif">
              S{semester} {fmt(semesterInfo.raw)}
            </small>
          )}
          <GradeBadge
            value={annual.official}
            title={annual.overridden ? 'Note annuelle du bulletin' : `Note annuelle calculée (${fmt(annual.raw)})`}
          />
        </span>
      </summary>

      <div className="discipline-body">
        {annual.branches && (
          <ul className="branches">
            {annual.branches.map((b) => (
              <li key={b.id}>
                {b.name} <span className="muted">{fmt(b.raw)}</span> <GradeBadge value={b.official} />
              </li>
            ))}
          </ul>
        )}

        {tests.length > 0 ? (
          <table className="tests">
            <thead>
              <tr>
                <th>Test</th>
                <th>Note</th>
                <th>Poids</th>
                <th aria-label="Supprimer" />
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.label || <span className="muted">{t.date ?? 'Test'}</span>}
                    {discipline.branches && <small className="muted"> · {branchName(branchOf(discipline, t))}</small>}
                  </td>
                  <td>
                    <GradeField
                      label="Note"
                      value={t.grade}
                      onCommit={(v) => v !== null && updateTest(profileId, year.id, t.id, { grade: v })}
                    />
                  </td>
                  <td>
                    <GradeField
                      label="Poids"
                      value={t.weight}
                      min={0.01}
                      max={100}
                      onCommit={(v) => v !== null && updateTest(profileId, year.id, t.id, { weight: v })}
                    />
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label="Supprimer le test"
                      onClick={() => confirm('Supprimer ce test ?') && deleteTest(profileId, year.id, t.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Aucun test ce semestre.</p>
        )}

        <form className="add-test" onSubmit={submit}>
          <input
            aria-label="Nouvelle note"
            inputMode="decimal"
            placeholder="Note"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          />
          <input
            aria-label="Poids"
            inputMode="decimal"
            placeholder="Poids"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="narrow"
          />
          <input aria-label="Libellé" placeholder="Libellé (optionnel)" value={label} onChange={(e) => setLabel(e.target.value)} />
          {discipline.branches && (
            <select aria-label="Branche" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {discipline.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <button className="button primary" type="submit">
            Ajouter
          </button>
        </form>
        {error && <p className="error">{error}</p>}

        <div className="card-footer">
          <p className="projection">
            Pour{' '}
            <select aria-label="Objectif" value={target} onChange={(e) => setTarget(Number(e.target.value))}>
              {TARGETS.map((t) => (
                <option key={t} value={t}>
                  {fmt(t)}
                </option>
              ))}
            </select>{' '}
            {discipline.branches ? `en ${branchName(branchId)} sur l’année` : 'sur l’année'}
            {' : '}
            {projection.status === 'secured' && <strong className="tone-good-text">déjà assuré 🎉</strong>}
            {projection.status === 'impossible' && (
              <strong className="tone-low-text">hors de portée avec un seul test</strong>
            )}
            {projection.status === 'reachable' && (
              <>
                il te faut au moins <strong>{fmt(projection.needed)}</strong> au prochain test
                {nextWeight && nextWeight !== 1 ? ` (poids ${fmt(nextWeight)})` : ''}.
              </>
            )}
          </p>
          <label className="field inline">
            <span>Note annuelle du bulletin</span>
            <GradeField
              label="Note annuelle du bulletin"
              value={year.overrides[overrideKey(discipline.id)]}
              placeholder={annual.official !== null && !annual.overridden ? fmt(annual.official) : '–'}
              onCommit={(v) => setOverride(profileId, year.id, discipline.id, v)}
            />
          </label>
        </div>
      </div>
    </details>
  );
}
