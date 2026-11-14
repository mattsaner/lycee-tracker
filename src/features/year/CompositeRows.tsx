import { useState, type FormEvent } from 'react';
import { compositeValue } from '../../domain/averages';
import type { CompositeRounding, Semester, Test } from '../../domain/types';
import { useStore } from '../../store/store';
import { fmt, isValidGrade, parseNumber } from '../../ui/format';
import { GradeBadge, GradeField } from '../../ui/GradeField';

export const ROUNDING_LABELS: Record<CompositeRounding, string> = {
  tenth: 'au dixième',
  quarter: 'au quart',
  none: 'sans arrondi',
};

interface Props {
  profileId: string;
  yearId: string;
  test: Test;
  semester: Semester;
  branchName?: string;
}

/** A composed grade: one row counted once in the average, plus a row to manage its sub-grades. */
export function CompositeRows({ profileId, yearId, test, semester, branchName }: Props) {
  const updateTest = useStore((s) => s.updateTest);
  const deleteTest = useStore((s) => s.deleteTest);
  const addPart = useStore((s) => s.addPart);
  const updatePart = useStore((s) => s.updatePart);
  const deletePart = useStore((s) => s.deletePart);
  const [grade, setGrade] = useState('');
  const [invalid, setInvalid] = useState(false);

  const parts = test.parts ?? [];
  const value = compositeValue(test);
  const semesterValue = compositeValue(test, semester);
  const spansYear = parts.some((p) => p.semester !== semester);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const g = parseNumber(grade);
    if (!isValidGrade(g)) return setInvalid(true);
    addPart(profileId, yearId, test.id, { grade: g, semester, date: new Date().toISOString().slice(0, 10) });
    setGrade('');
    setInvalid(false);
  };

  return (
    <>
      <tr className="composite-row">
        <td>
          {test.label || <span className="muted">Note composée</span>}
          {branchName && <small className="muted"> · {branchName}</small>}
          <br />
          <small className="muted">
            Composée · {parts.length} note{parts.length > 1 ? 's' : ''}
            {spansYear && semesterValue !== null && ` · S${semester} ${fmt(semesterValue)}`}
          </small>
        </td>
        <td>
          <GradeBadge value={value} title="Moyenne des sous-notes de l’année" />
        </td>
        <td>
          <GradeField
            label="Poids"
            value={test.weight}
            min={0.01}
            max={100}
            onCommit={(v) => v !== null && updateTest(profileId, yearId, test.id, { weight: v })}
          />
        </td>
        <td>
          <button
            className="icon-button"
            aria-label="Supprimer la note composée"
            onClick={() =>
              confirm('Supprimer cette note composée et toutes ses sous-notes ?') &&
              deleteTest(profileId, yearId, test.id)
            }
          >
            ✕
          </button>
        </td>
      </tr>
      <tr className="parts-row">
        <td colSpan={4}>
          <ul className="parts">
            {parts.map((p) => (
              <li key={p.id} className={p.semester === semester ? '' : 'other-semester'}>
                <GradeField
                  label={`Sous-note S${p.semester}`}
                  value={p.grade}
                  className="small"
                  onCommit={(v) => v !== null && updatePart(profileId, yearId, test.id, p.id, { grade: v })}
                />
                <small className="muted">S{p.semester}</small>
                <button
                  className="icon-button"
                  aria-label="Supprimer la sous-note"
                  onClick={() => deletePart(profileId, yearId, test.id, p.id)}
                >
                  ✕
                </button>
              </li>
            ))}
            <li>
              <form onSubmit={submit} className="add-part">
                <input
                  aria-label="Nouvelle sous-note"
                  aria-invalid={invalid}
                  className={`grade-field small${invalid ? ' invalid' : ''}`}
                  inputMode="decimal"
                  placeholder="+ note"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                />
                <button className="button small" type="submit" aria-label="Ajouter la sous-note">
                  +
                </button>
              </form>
            </li>
          </ul>
          <label className="rounding">
            <small className="muted">Arrondi</small>
            <select
              aria-label="Arrondi de la note composée"
              value={test.rounding ?? 'tenth'}
              onChange={(e) =>
                updateTest(profileId, yearId, test.id, { rounding: e.target.value as CompositeRounding })
              }
            >
              {(Object.keys(ROUNDING_LABELS) as CompositeRounding[]).map((r) => (
                <option key={r} value={r}>
                  {ROUNDING_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
        </td>
      </tr>
    </>
  );
}
