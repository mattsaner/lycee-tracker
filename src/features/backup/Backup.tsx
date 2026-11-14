import { useState, type ChangeEvent } from 'react';
import { parseBackup } from '../../store/backup';
import { useStore } from '../../store/store';
import { useExportBackup } from './BackupReminder';

const FREQUENCIES: [number, string][] = [
  [1, 'Chaque jour'],
  [7, 'Chaque semaine'],
  [14, 'Toutes les deux semaines'],
  [30, 'Chaque mois'],
  [0, 'Jamais'],
];

/** A real backup weighs a few kilobytes; this only protects against a wrong, huge file. */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' });

export function Backup() {
  const profiles = useStore((s) => s.profiles);
  const importProfiles = useStore((s) => s.importProfiles);
  const backup = useStore((s) => s.backup);
  const setReminderFrequency = useStore((s) => s.setReminderFrequency);
  const exportBackup = useExportBackup();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage({ ok: false, text: 'Fichier trop volumineux pour être une sauvegarde Lycée Tracker.' });
      return;
    }
    try {
      const { profiles: incoming, warnings } = parseBackup(await file.text());
      const replaced = incoming.filter((p) => profiles.some((q) => q.id === p.id));
      if (
        replaced.length &&
        !confirm(`Remplacer ${replaced.map((p) => p.name).join(', ')} par la version du fichier ?`)
      )
        return;
      importProfiles(incoming);
      setMessage({
        ok: true,
        text: [`${incoming.length} profil(s) importé(s).`, ...warnings].join(' '),
      });
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    }
  };

  return (
    <section className="card form">
      <h1>Sauvegarde</h1>
      <p>
        Tes notes sont enregistrées uniquement dans ce navigateur. Si tu vides les données du navigateur ou changes
        d’appareil, elles sont perdues : exporte un fichier régulièrement, puis importe-le sur l’autre appareil.
      </p>
      <div className="actions">
        <button className="button primary" onClick={exportBackup} disabled={profiles.length === 0}>
          Exporter ({profiles.length} profil{profiles.length > 1 ? 's' : ''})
        </button>
        <label className="button">
          Importer un fichier…
          <input type="file" accept="application/json,.json" onChange={onFile} hidden />
        </label>
      </div>
      {message && <p className={message.ok ? 'success' : 'error'}>{message.text}</p>}

      <p>
        {backup.lastExportAt
          ? `Dernière sauvegarde : ${fmtDate(backup.lastExportAt)}.`
          : 'Aucune sauvegarde pour l’instant.'}{' '}
        {backup.unsavedSince ? (
          <strong className="tone-low-text">Des modifications ne sont pas sauvegardées.</strong>
        ) : (
          backup.lastExportAt && <span className="tone-good-text">Tout est sauvegardé.</span>
        )}
      </p>
      <label className="field inline">
        <span>Me rappeler de sauvegarder</span>
        <select value={backup.frequencyDays} onChange={(e) => setReminderFrequency(Number(e.target.value))}>
          {FREQUENCIES.map(([days, label]) => (
            <option key={days} value={days}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted small">
        Le fichier contient tes notes : ne le publie pas. Un import fusionne les profils (un profil existant portant le
        même identifiant est remplacé).
      </p>
    </section>
  );
}
