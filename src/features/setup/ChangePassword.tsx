import { useState, type FormEvent } from 'react';
import { WrongPasswordError } from '../../crypto/vault';
import { useStore } from '../../store/store';
import { newPasswordProblem, PasswordFields } from '../../ui/PasswordFields';

export function ChangePassword({ profileId }: { profileId: string }) {
  const changePassword = useStore((s) => s.changePassword);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const problem = newPasswordProblem(password, confirmation);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (problem || !current || busy) return;
    setBusy(true);
    try {
      await changePassword(profileId, current, password);
      setMessage({
        ok: true,
        text: 'Mot de passe changé. Les anciennes sauvegardes s’ouvrent toujours avec l’ancien : exporte une nouvelle sauvegarde.',
      });
      setCurrent('');
      setPassword('');
      setConfirmation('');
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof WrongPasswordError ? 'Mot de passe actuel incorrect.' : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Changer le mot de passe</h2>
      <label className="field">
        <span>Mot de passe actuel</span>
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </label>
      <PasswordFields
        label="Nouveau mot de passe"
        password={password}
        confirmation={confirmation}
        onPassword={setPassword}
        onConfirmation={setConfirmation}
      />
      <div className="actions">
        <button className="button primary" type="submit" disabled={!!problem || !current || busy}>
          {busy ? 'Chiffrement…' : 'Changer le mot de passe'}
        </button>
      </div>
      {message && <p className={message.ok ? 'success' : 'error'}>{message.text}</p>}
    </form>
  );
}
