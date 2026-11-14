import { passwordProblem } from '../crypto/vault';

interface Props {
  password: string;
  confirmation: string;
  onPassword: (v: string) => void;
  onConfirmation: (v: string) => void;
  label?: string;
}

/** Problem with a new password and its confirmation, or null when both are fine. */
export function newPasswordProblem(password: string, confirmation: string): string | null {
  return (
    passwordProblem(password) ?? (password !== confirmation ? 'Les deux mots de passe ne correspondent pas.' : null)
  );
}

/** New password with confirmation. */
export function PasswordFields({ password, confirmation, onPassword, onConfirmation, label = 'Mot de passe' }: Props) {
  const problem = password || confirmation ? newPasswordProblem(password, confirmation) : null;
  return (
    <>
      <div className="row">
        <label className="field">
          <span>{label}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Confirmation</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => onConfirmation(e.target.value)}
            required
          />
        </label>
      </div>
      {problem && <p className="error small">{problem}</p>}
      <p className="warning small">
        🔐 Tes notes sont chiffrées avec ce mot de passe. <strong>S’il est oublié, elles sont perdues</strong> :
        personne ne peut le récupérer. Note-le dans un endroit sûr.
      </p>
    </>
  );
}
