import { Component, type ReactNode } from 'react';

const STORAGE_KEY = 'lycee-tracker';

/** Downloads the raw saved data, readable even when the app itself cannot start. */
function downloadRawData() {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '{}';
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `lycee-tracker-secours-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Last-resort screen: never lose the grades because of a bug in the interface. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="container">
        <section className="card">
          <h1>Oups, l’application a rencontré un problème</h1>
          <p>
            Tes notes sont toujours enregistrées dans ce navigateur. Télécharge une copie de secours, puis recharge.
          </p>
          <div className="actions">
            <button className="button primary" onClick={downloadRawData}>
              Télécharger mes données
            </button>
            <button className="button" onClick={() => location.reload()}>
              Recharger
            </button>
          </div>
          <p className="muted small">Détail : {this.state.error.message}</p>
        </section>
      </main>
    );
  }
}
