import { Link } from 'react-router-dom';
import { downloadBackup } from '../../store/backup';
import { reminderDueDays, useStore } from '../../store/store';

/** Downloads a backup of every profile and records the export. */
export function useExportBackup(): () => void {
  const markExported = useStore((s) => s.markExported);
  return () => {
    downloadBackup(useStore.getState().profiles);
    markExported();
  };
}

/** Banner shown when changes have not been exported for longer than the chosen interval. */
export function BackupReminder() {
  const backup = useStore((s) => s.backup);
  const hasProfiles = useStore((s) => s.profiles.length > 0);
  const snooze = useStore((s) => s.snoozeReminder);
  const exportBackup = useExportBackup();
  const days = reminderDueDays(backup);

  if (days === null || !hasProfiles) return null;

  return (
    <div className="reminder" role="status">
      <p>
        💾 Tes dernières notes ne sont pas sauvegardées
        {backup.lastExportAt
          ? ` (dernière sauvegarde il y a ${Math.floor((Date.now() - Date.parse(backup.lastExportAt)) / 86_400_000)} jours)`
          : ''}
        . Elles ne sont que dans ce navigateur : exporte une copie.
      </p>
      <div className="actions">
        <button className="button primary small" onClick={exportBackup}>
          Exporter maintenant
        </button>
        <button className="button small" onClick={() => snooze(1)}>
          Plus tard
        </button>
        <Link to="/sauvegarde" className="small">
          Réglages
        </Link>
      </div>
    </div>
  );
}
