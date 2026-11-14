import { Link } from 'react-router-dom';
import { LEVEL_LABELS, OS_LABELS } from '../../data/curriculum';
import { useStore } from '../../store/store';

export function Home() {
  const profiles = useStore((s) => s.profiles);

  return (
    <>
      <section className="card intro">
        <h1>Suis tes notes au Lycée cantonal de Porrentruy</h1>
        <p>
          Saisis tes notes de tests, l’application calcule tes moyennes semestrielles et annuelles, vérifie les
          conditions de promotion (double compensation, notes insuffisantes) et simule ta maturité.
        </p>
        <p className="muted">
          Aucune inscription, aucun serveur : tes données restent dans ce navigateur. Pense à faire une{' '}
          <Link to="/sauvegarde">sauvegarde</Link> de temps en temps.
        </p>
      </section>

      <div className="section-head">
        <h2>Profils</h2>
        <Link to="/nouveau" className="button primary">
          + Nouveau profil
        </Link>
      </div>

      {profiles.length === 0 ? (
        <p className="muted">Aucun profil pour l’instant. Crée le tien pour commencer.</p>
      ) : (
        <ul className="profile-list">
          {profiles.map((p) => {
            const year = p.years[p.years.length - 1];
            return (
              <li key={p.id}>
                <Link to={`/profil/${p.id}`} className="card profile-card">
                  <strong>{p.name}</strong>
                  <span className="muted">
                    {year ? `${LEVEL_LABELS[year.level]} · ${year.label}` : 'Aucune année'} · OS{' '}
                    {OS_LABELS[p.choices.os]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
