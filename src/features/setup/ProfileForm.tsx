import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import {
  ARTS_LABELS,
  BILINGUAL_EXAM_LABELS,
  L2_LABELS,
  L3_LABELS,
  LEVEL_LABELS,
  OC_LABELS,
  OS_LABELS,
} from '../../data/curriculum';
import { l3BlockReason, normalizeChoices, ocBlockReason, osBlockReason, validateChoices } from '../../domain/choices';
import type { Choices, L3Id, Level, OcId, OsId } from '../../domain/types';
import { currentSchoolYearLabel, useEntry, useProfile, useStore } from '../../store/store';
import { newPasswordProblem, PasswordFields } from '../../ui/PasswordFields';
import { ChangePassword } from './ChangePassword';

const DEFAULT_CHOICES: Choices = {
  track: 'standard',
  l2: 'allemand',
  l3: 'anglais',
  arts: 'arts-visuels',
  os: 'espagnol',
};

function Select<T extends string>(props: {
  label: string;
  value: T;
  options: T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
  hint?: string;
  /** Options that the rules exclude stay visible but disabled, with the reason. */
  blockReason?: (v: T) => string | null;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
        {props.options.map((o) => {
          const reason = props.blockReason?.(o);
          return (
            <option key={o} value={o} disabled={!!reason}>
              {props.labels[o]}
              {reason ? ` (${reason})` : ''}
            </option>
          );
        })}
      </select>
      {props.hint && <small className="muted">{props.hint}</small>}
    </label>
  );
}

export function ProfileForm() {
  const { profileId } = useParams();
  const existing = useProfile(profileId);
  const navigate = useNavigate();
  const entry = useEntry(profileId);
  const createProfile = useStore((s) => s.createProfile);
  const updateProfile = useStore((s) => s.updateProfile);
  const deleteProfile = useStore((s) => s.deleteProfile);

  const [name, setName] = useState(existing?.name ?? '');
  const [choices, setChoices] = useState<Choices>(existing?.choices ?? DEFAULT_CHOICES);
  const [level, setLevel] = useState<Level>(1);
  const [label, setLabel] = useState(currentSchoolYearLabel());
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);

  if (profileId && !existing)
    return (
      <Navigate
        to={entry ? `/deverrouiller/${profileId}` : '/'}
        replace
        state={{ from: `/profil/${profileId}/modifier` }}
      />
    );

  const update = (patch: Partial<Choices>) => setChoices((c) => normalizeChoices({ ...c, ...patch }));
  const errors = validateChoices(choices);

  const passwordError = existing ? null : newPasswordProblem(password, confirmation);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (errors.length || !name.trim() || passwordError || busy) return;
    if (existing) {
      updateProfile(existing.id, { name: name.trim(), choices });
      navigate(`/profil/${existing.id}`);
    } else {
      setBusy(true);
      const p = await createProfile(name.trim(), choices, level, label.trim() || currentSchoolYearLabel(), password);
      navigate(`/profil/${p.id}`);
    }
  };

  const remove = () => {
    if (existing && confirm(`Supprimer le profil « ${existing.name} » et toutes ses notes ?`)) {
      deleteProfile(existing.id);
      navigate('/');
    }
  };

  return (
    <>
      <form className="card form" onSubmit={submit}>
        <h1>{existing ? 'Modifier le profil' : 'Nouveau profil'}</h1>

        <label className="field">
          <span>Prénom ou pseudo</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoFocus />
        </label>

        {!existing && (
          <div className="row">
            <label className="field">
              <span>Année au lycée</span>
              <select value={level} onChange={(e) => setLevel(Number(e.target.value) as Level)}>
                {([1, 2, 3] as Level[]).map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABELS[l]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Année scolaire</span>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="2025-2026" />
            </label>
          </div>
        )}

        <fieldset>
          <legend>Filière</legend>
          <div className="segmented">
            {(['standard', 'bilingue'] as const).map((t) => (
              <label key={t} className={choices.track === t ? 'active' : ''}>
                <input type="radio" name="track" checked={choices.track === t} onChange={() => update({ track: t })} />
                {t === 'standard' ? 'Maturité' : 'Maturité bilingue FR-DE'}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Langues et art</legend>
          <div className="row">
            <Select
              label="Langue 2"
              value={choices.l2}
              options={choices.track === 'bilingue' ? ['allemand'] : ['allemand', 'italien']}
              labels={L2_LABELS}
              onChange={(l2) => update({ l2 })}
            />
            <Select
              label="Langue 3"
              value={choices.l3}
              options={Object.keys(L3_LABELS) as L3Id[]}
              blockReason={(l3) => l3BlockReason(choices, l3)}
              labels={L3_LABELS}
              onChange={(l3) => update({ l3 })}
            />
          </div>
          <Select
            label="Discipline artistique"
            value={choices.arts}
            options={choices.os === 'arts-visuels' ? ['musique'] : ['arts-visuels', 'musique']}
            labels={ARTS_LABELS}
            onChange={(arts) => update({ arts })}
            hint={choices.os === 'arts-visuels' ? 'L’OS arts visuels implique la musique.' : undefined}
          />
        </fieldset>

        <fieldset>
          <legend>Options</legend>
          <Select
            label="Option spécifique (OS)"
            value={choices.os}
            options={Object.keys(OS_LABELS) as OsId[]}
            blockReason={(os) => osBlockReason(choices, os)}
            hint={
              osBlockReason(choices, 'anglais') || osBlockReason(choices, 'italien')
                ? 'Une langue déjà choisie en langue 2 ou 3 ne peut pas être l’OS : change la langue 3 pour la sélectionner.'
                : undefined
            }
            labels={OS_LABELS}
            onChange={(os) => update({ os })}
          />
          <label className="field">
            <span>Option complémentaire (OC, dès la 2e)</span>
            <select
              value={choices.oc ?? ''}
              onChange={(e) => update({ oc: (e.target.value || undefined) as OcId | undefined })}
            >
              <option value="">Pas encore choisie</option>
              {(Object.keys(OC_LABELS) as OcId[]).map((o) => {
                const reason = ocBlockReason(choices, o);
                return (
                  <option key={o} value={o} disabled={!!reason}>
                    {OC_LABELS[o]}
                    {reason ? ` (${reason})` : ''}
                  </option>
                );
              })}
            </select>
            <small className="muted">Le choix se fait pendant la 1re année ; tu pourras le compléter plus tard.</small>
          </label>
          {choices.track === 'bilingue' && choices.bilingualExam && (
            <Select
              label="Examen de maturité en allemand"
              value={choices.bilingualExam}
              options={['physique', 'histoire']}
              labels={BILINGUAL_EXAM_LABELS}
              onChange={(bilingualExam) => update({ bilingualExam })}
              hint="Remplace l’examen de l’option complémentaire."
            />
          )}
        </fieldset>

        {!existing && (
          <fieldset>
            <legend>Mot de passe</legend>
            <PasswordFields
              password={password}
              confirmation={confirmation}
              onPassword={setPassword}
              onConfirmation={setConfirmation}
            />
          </fieldset>
        )}

        {errors.length > 0 && (
          <ul className="errors">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="actions">
          <button
            type="submit"
            className="button primary"
            disabled={errors.length > 0 || !name.trim() || !!passwordError || busy}
          >
            {existing ? 'Enregistrer' : busy ? 'Chiffrement…' : 'Créer le profil'}
          </button>
          <button type="button" className="button" onClick={() => navigate(-1)}>
            Annuler
          </button>
          {existing && (
            <button type="button" className="button danger" onClick={remove}>
              Supprimer le profil
            </button>
          )}
        </div>
      </form>
      {existing && <ChangePassword profileId={existing.id} />}
    </>
  );
}
