import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { WrongPasswordError } from '../../crypto/vault';
import { useEntry, useProfile, useStore } from '../../store/store';
import { newPasswordProblem, PasswordFields } from '../../ui/PasswordFields';

/** Asks the profile's password, or a new one for a profile saved before passwords existed. */
export function Unlock() {
  const { profileId } = useParams();
  const entry = useEntry(profileId);
  const unlocked = useProfile(profileId);
  const unlock = useStore((s) => s.unlock);
  const protectLegacy = useStore((s) => s.protectLegacy);
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? `/profil/${profileId}`;

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!entry) return <Navigate to="/" replace />;
  if (unlocked) return <Navigate to={from} replace />;
  const legacy = !entry.sealed;
  const problem = legacy ? newPasswordProblem(password, confirmation) : password ? null : 'Mot de passe requis.';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (problem || busy) return;
    setBusy(true);
    setError('');
    try {
      if (legacy) await protectLegacy(entry.id, password);
      else await unlock(entry.id, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof WrongPasswordError ? 'Mot de passe incorrect.' : (err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className="card form unlock" onSubmit={submit}>
      <h1>🔒 {entry.name}</h1>
      {legacy ? (
        <>
          <p>Ce profil n’est pas encore protégé. Choisis un mot de passe pour chiffrer ses notes.</p>
          <PasswordFields
            password={password}
            confirmation={confirmation}
            onPassword={setPassword}
            onConfirmation={setConfirmation}
          />
        </>
      ) : (
        <label className="field">
          <span>Mot de passe</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
        </label>
      )}
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="button primary" type="submit" disabled={!!problem || busy}>
          {busy ? 'Vérification…' : legacy ? 'Protéger et ouvrir' : 'Ouvrir'}
        </button>
        <Link to="/" className="button">
          Retour
        </Link>
      </div>
      {!legacy && (
        <p className="muted small">
          Mot de passe oublié ? Il ne peut pas être récupéré. Si tu as une sauvegarde exportée avec un mot de passe dont
          tu te souviens, importe-la depuis la page Sauvegarde.
        </p>
      )}
    </form>
  );
}
