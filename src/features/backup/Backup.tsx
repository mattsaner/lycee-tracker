import { useState, type ChangeEvent } from 'react';
import { downloadBackup, parseBackup } from '../../store/backup';
import { useStore } from '../../store/store';

export function Backup() {
  const profiles = useStore((s) => s.profiles);
  const importProfiles = useStore((s) => s.importProfiles);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const incoming = parseBackup(await file.text());
      const replaced = incoming.filter((p) => profiles.some((q) => q.id === p.id));
      if (replaced.length && !confirm(`Remplacer ${replaced.map((p) => p.name).join(', ')} par la version du fichier ?`))
        return;
      importProfiles(incoming);
      setMessage({ ok: true, text: `${incoming.length} profil(s) importé(s).` });
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
        <button className="button primary" onClick={() => downloadBackup(profiles)} disabled={profiles.length === 0}>
          Exporter ({profiles.length} profil{profiles.length > 1 ? 's' : ''})
        </button>
        <label className="button">
          Importer un fichier…
          <input type="file" accept="application/json,.json" onChange={onFile} hidden />
        </label>
      </div>
      {message && <p className={message.ok ? 'success' : 'error'}>{message.text}</p>}
      <p className="muted small">
        Le fichier contient tes notes : ne le publie pas. Un import fusionne les profils (un profil existant portant le
        même identifiant est remplacé).
      </p>
    </section>
  );
}
