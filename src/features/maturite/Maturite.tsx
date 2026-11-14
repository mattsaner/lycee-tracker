import { useOutletContext } from 'react-router-dom';
import { CORE_MINIMUM, evaluateMaturite, TM_ID } from '../../domain/maturite';
import { useStore } from '../../store/store';
import { fmt } from '../../ui/format';
import { GradeBadge, GradeField } from '../../ui/GradeField';
import type { ProfileContext } from '../profile/ProfileLayout';
import { RuleChecks } from '../summary/RuleChecks';

export function Maturite() {
  const { profile } = useOutletContext<ProfileContext>();
  const setExam = useStore((s) => s.setExam);
  const setSchoolOverride = useStore((s) => s.setSchoolOverride);
  const setTm = useStore((s) => s.setTm);
  const result = evaluateMaturite(profile);
  const anyGrade = result.rows.some((r) => r.final !== null);

  return (
    <>
      <section className={`card verdict ${!result.complete ? '' : result.passed ? 'pass' : 'fail'}`}>
        <h2>
          {!anyGrade
            ? 'Simulateur de maturité'
            : result.complete
              ? result.passed
                ? 'Maturité réussie'
                : 'Conditions de maturité non remplies'
              : 'Simulation en cours'}
          {anyGrade && !result.complete && <span className="pill">incomplet</span>}
        </h2>
        {anyGrade && (
          <>
            <RuleChecks check={result.check} />
            <ul className="checks">
              <li className={result.coreOk ? 'ok' : 'ko'}>
                <span aria-hidden>{result.coreOk ? '✓' : '✗'}</span> Français + langue 2 + mathématiques + OS :{' '}
                <strong>{fmt(result.coreSum)}</strong> (minimum {CORE_MINIMUM})
              </li>
            </ul>
          </>
        )}
      </section>

      <section className="card">
        <table className="summary maturite">
          <thead>
            <tr>
              <th>Discipline</th>
              <th>École</th>
              <th>Examen</th>
              <th>Maturité</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>
                  {r.id === TM_ID ? (
                    <GradeField label="Note du travail de maturité" value={profile.maturite.tm} onCommit={(v) => setTm(profile.id, v)} />
                  ) : (
                    <GradeField
                      label={`Note d’école ${r.name}`}
                      value={r.schoolOverridden ? r.school : undefined}
                      placeholder={r.school !== null && !r.schoolOverridden ? fmt(r.school) : '–'}
                      className={r.schoolOverridden ? 'overridden' : ''}
                      onCommit={(v) => setSchoolOverride(profile.id, r.id, v)}
                    />
                  )}
                </td>
                <td>
                  {r.withExam ? (
                    <GradeField label={`Examen ${r.name}`} value={r.exam} onCommit={(v) => setExam(profile.id, r.id, v)} />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <GradeBadge value={r.final} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          La note d’école est calculée à partir de la dernière année où la discipline est enseignée (par ex. la 2e pour la
          biologie ou les arts). Si tu n’as pas suivi cette année dans l’application, saisis-la à la main. Avec examen : la
          note de maturité est la moyenne de la note d’école et de la note d’examen, arrondie au demi-point (x.25 et x.75
          vers le haut). L’éducation physique figure au certificat mais ne compte pas.
        </p>
      </section>

      <section className="card rules">
        <h3>Conditions d’obtention</h3>
        <ol>
          <li>Le double de la somme des écarts sous 4 n’est pas supérieur à la somme des écarts au-dessus de 4.</li>
          <li>Au plus quatre notes insuffisantes.</li>
          <li>Aucune note inférieure à 2.</li>
          <li>La somme français + langue 2 + mathématiques + option spécifique vaut au moins 16.</li>
        </ol>
        <p className="muted small">
          Source : ordonnance concernant les examens de la maturité gymnasiale (RSJU 412.351, art. 8, 14 et 16a).
        </p>
      </section>
    </>
  );
}
