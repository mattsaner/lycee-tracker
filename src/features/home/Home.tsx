import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LEVEL_LABELS, OS_LABELS } from '../../data/curriculum';
import { useStore } from '../../store/store';

export function Home() {
  const entries = useStore((s) => s.vault);
  const unlocked = useStore((s) => s.profiles);
  const lock = useStore((s) => s.lock);
  const navigate = useNavigate();
  const lockId = (useLocation().state as { lock?: string } | null)?.lock;

  // Arriving from the "Verrouiller" button.
  useEffect(() => {
    if (!lockId) return;
    lock(lockId);
    navigate('/', { replace: true, state: null });
  }, [lockId, lock, navigate]);

  return (
    <>
      <section className="card intro">
        <h1>Suis tes notes au Lycée cantonal de Porrentruy</h1>
        <p>
          Saisis tes notes de tests, l’application calcule tes moyennes semestrielles et annuelles, vérifie les
          conditions de promotion (double compensation, notes insuffisantes) et simule ta maturité.
        </p>
        <p className="muted">
          Aucune inscription, aucun serveur : tes données restent dans ce navigateur, chiffrées avec ton mot de passe.
          Pense à faire une <Link to="/sauvegarde">sauvegarde</Link> de temps en temps.
        </p>
      </section>

      <div className="section-head">
        <h2>Profils</h2>
        <Link to="/nouveau" className="button primary">
          + Nouveau profil
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="muted">Aucun profil pour l’instant. Crée le tien pour commencer.</p>
      ) : (
        <ul className="profile-list">
          {entries.map((e) => {
            // Details are only readable once the profile is unlocked.
            const p = unlocked.find((u) => u.id === e.id);
            const year = p?.years[p.years.length - 1];
            return (
              <li key={e.id}>
                <Link to={`/profil/${e.id}`} className="card profile-card">
                  <strong>
                    {p ? '🔓' : '🔒'} {e.name}
                  </strong>
                  <span className="muted">
                    {p
                      ? `${year ? `${LEVEL_LABELS[year.level]} · ${year.label}` : 'Aucune année'} · OS ${OS_LABELS[p.choices.os]}`
                      : e.sealed
                        ? 'Verrouillé'
                        : 'À protéger par un mot de passe'}
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
