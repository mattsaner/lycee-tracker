import { useOutletContext } from 'react-router-dom';
import { evaluatePromotion } from '../../domain/promotion';
import { fmt } from '../../ui/format';
import { GradeBadge } from '../../ui/GradeField';
import type { ProfileContext } from '../profile/ProfileLayout';
import { RuleChecks } from './RuleChecks';

export function YearSummary() {
  const { profile, year } = useOutletContext<ProfileContext>();
  if (!year) return <p>Année introuvable.</p>;
  const result = evaluatePromotion(profile.choices, year);
  const { check } = result;
  const anyGrade = result.missing.length < result.rows.length;

  return (
    <>
      <section className={`card verdict ${!anyGrade ? '' : check.passed ? 'pass' : 'fail'}`}>
        <h2>
          {!anyGrade
            ? 'Pas encore de notes'
            : check.passed
              ? 'Promotion obtenue'
              : 'Conditions de promotion non remplies'}
          {anyGrade && result.provisional && <span className="pill">provisoire</span>}
        </h2>
        {anyGrade && <RuleChecks check={check} />}
        {result.missing.length > 0 && anyGrade && (
          <p className="muted">Sans note (ignorées) : {result.missing.map((d) => d.name).join(', ')}.</p>
        )}
      </section>

      <section className="card">
        <table className="summary">
          <thead>
            <tr>
              <th>Discipline</th>
              <th title="À titre indicatif">S1</th>
              <th title="À titre indicatif">S2</th>
              <th>Année</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map(({ discipline, annual }) => (
              <tr key={discipline.id}>
                <td>{discipline.name}</td>
                <td className="muted">{fmt(annual.s1.raw)}</td>
                <td className="muted">{fmt(annual.s2.raw)}</td>
                <td>
                  <GradeBadge
                    value={annual.value}
                    title={annual.overridden ? 'Note du bulletin' : `Moyenne de l’année : ${fmt(annual.raw)}`}
                  />
                  {annual.provisional && <sup className="muted">*</sup>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          La note de l’année est la moyenne pondérée de tous les tests de l’année, arrondie au demi-point ; les
          moyennes S1 et S2 sont indicatives. * Pas encore de note au 2e semestre. Moyenne générale indicative :{' '}
          {fmt(
            (() => {
              const values = result.rows.map((r) => r.annual.value).filter((v): v is number => v !== null);
              return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
            })(),
          )}
          .
        </p>
      </section>

      <section className="card rules">
        <h3>Règles de promotion</h3>
        <p>
          La promotion est obtenue si, pour l’ensemble des disciplines (y compris l’éducation physique, l’OS et l’OC) :
        </p>
        <ol>
          <li>
            <strong>Double compensation</strong> : le double de la somme des écarts sous 4 n’est pas supérieur à la
            somme des écarts au-dessus de 4.
          </li>
          <li>Au plus quatre notes annuelles inférieures à 4.</li>
          <li>Aucune note inférieure à 2.</li>
        </ol>
        <p className="muted small">
          Une même année ne peut être répétée qu’une fois. Une promotion conditionnelle peut être accordée une fois par le
          conseil de classe. Source : règlement concernant l’organisation des études au Lycée cantonal (RSJU 412.311.1, art.
          29 à 37).
        </p>
      </section>
    </>
  );
}
