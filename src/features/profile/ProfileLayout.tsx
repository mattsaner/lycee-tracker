import { useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { LEVEL_LABELS, OC_LABELS, OS_LABELS } from '../../data/curriculum';
import { ocMissing } from '../../domain/choices';
import type { Level, Profile, SchoolYear } from '../../domain/types';
import { useEntry, useProfile, useStore } from '../../store/store';

export interface ProfileContext {
  profile: Profile;
  year?: SchoolYear;
}

function nextLabel(label: string): string {
  const m = /^(\d{4})-(\d{4})$/.exec(label);
  return m ? `${Number(m[1]) + 1}-${Number(m[2]) + 1}` : '';
}

export function ProfileLayout() {
  const { profileId, yearId } = useParams();
  const profile = useProfile(profileId);
  const entry = useEntry(profileId);
  const addYear = useStore((s) => s.addYear);
  const deleteYear = useStore((s) => s.deleteYear);
  const navigate = useNavigate();
  const location = useLocation();
  const [adding, setAdding] = useState(false);

  if (!profile)
    return entry ? (
      <Navigate to={`/deverrouiller/${profileId}`} replace state={{ from: location.pathname }} />
    ) : (
      <Navigate to="/" replace />
    );
  const year = profile.years.find((y) => y.id === yearId);
  const last = profile.years[profile.years.length - 1];
  const base = `/profil/${profile.id}`;
  const onSummary = location.pathname.endsWith('/bilan');

  const switchYear = (id: string) => navigate(`${base}/annee/${id}${onSummary ? '/bilan' : ''}`);

  const submitYear = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const y = addYear(profile.id, Number(data.get('level')) as Level, String(data.get('label')).trim());
    setAdding(false);
    navigate(`${base}/annee/${y.id}`);
  };

  const removeYear = () => {
    if (!year || profile.years.length < 2) return;
    if (confirm(`Supprimer l’année ${year.label} (${LEVEL_LABELS[year.level]}) et ses notes ?`)) {
      deleteYear(profile.id, year.id);
      navigate(base);
    }
  };

  const activeYear = year ?? last;

  return (
    <>
      <section className="profile-head">
        <div>
          <h1>{profile.name}</h1>
          <p className="muted">
            OS {OS_LABELS[profile.choices.os]} · OC {profile.choices.oc ? OC_LABELS[profile.choices.oc] : 'à choisir'}
            {profile.choices.track === 'bilingue' && ' · Bilingue'}
          </p>
        </div>
        <div>
          <Link to={`${base}/modifier`} className="button small">
            Modifier
          </Link>
          <button
            className="button small"
            // Locking here would make this page redirect to the unlock screen; Home locks on arrival.
            onClick={() => navigate('/', { state: { lock: profile.id } })}
          >
            🔒 Verrouiller
          </button>
        </div>
      </section>

      <div className="toolbar">
        <label className="field inline">
          <span>Année</span>
          <select value={activeYear?.id ?? ''} onChange={(e) => switchYear(e.target.value)}>
            {profile.years.map((y) => (
              <option key={y.id} value={y.id}>
                {LEVEL_LABELS[y.level]} · {y.label}
              </option>
            ))}
          </select>
        </label>
        <button className="button small" onClick={() => setAdding((a) => !a)}>
          + Année
        </button>
        {year && profile.years.length > 1 && (
          <button className="button small danger" onClick={removeYear}>
            Supprimer l’année
          </button>
        )}
      </div>

      {adding && (
        <form
          className="card inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            submitYear(e.currentTarget);
          }}
        >
          <label className="field">
            <span>Niveau</span>
            <select name="level" defaultValue={String(Math.min((last?.level ?? 0) + 1, 3))}>
              {([1, 2, 3] as Level[]).map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Année scolaire</span>
            <input name="label" defaultValue={last ? nextLabel(last.label) : ''} placeholder="2026-2027" required />
          </label>
          <button className="button primary" type="submit">
            Ajouter
          </button>
          <small className="muted">En cas de redoublement, ajoute à nouveau le même niveau.</small>
        </form>
      )}

      {ocMissing(
        profile.choices,
        profile.years.map((y) => y.level),
      ) && (
        <p className="notice">
          L’option complémentaire commence en 2e année. <Link to={`${base}/modifier`}>Indique ton OC</Link> pour pouvoir
          saisir ses notes.
        </p>
      )}

      <nav className="tabs">
        {activeYear && (
          <>
            <NavLink to={`${base}/annee/${activeYear.id}`} end>
              Notes
            </NavLink>
            <NavLink to={`${base}/annee/${activeYear.id}/bilan`}>Bilan &amp; promotion</NavLink>
          </>
        )}
        <NavLink to={`${base}/maturite`}>Maturité</NavLink>
      </nav>

      <Outlet context={{ profile, year } satisfies ProfileContext} />
    </>
  );
}

export function ProfileIndex() {
  const { profileId } = useParams();
  const profile = useProfile(profileId);
  const last = profile?.years[profile.years.length - 1];
  if (!profile) return <Navigate to="/" replace />; // ProfileLayout already redirects locked profiles
  return last ? <Navigate to={`annee/${last.id}`} replace /> : <Navigate to="maturite" replace />;
}
