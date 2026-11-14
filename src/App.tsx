import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { Backup } from './features/backup/Backup';
import { Home } from './features/home/Home';
import { Maturite } from './features/maturite/Maturite';
import { ProfileIndex, ProfileLayout } from './features/profile/ProfileLayout';
import { ProfileForm } from './features/setup/ProfileForm';
import { YearSummary } from './features/summary/YearSummary';
import { YearNotes } from './features/year/YearNotes';

export function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <header className="app-header">
        <Link to="/" className="brand">
          📘 Lycée Tracker
        </Link>
        <nav>
          <Link to="/sauvegarde">Sauvegarde</Link>
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/nouveau" element={<ProfileForm />} />
          <Route path="/profil/:profileId/modifier" element={<ProfileForm />} />
          <Route path="/profil/:profileId" element={<ProfileLayout />}>
            <Route index element={<ProfileIndex />} />
            <Route path="annee/:yearId" element={<YearNotes />} />
            <Route path="annee/:yearId/bilan" element={<YearSummary />} />
            <Route path="maturite" element={<Maturite />} />
          </Route>
          <Route path="/sauvegarde" element={<Backup />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="app-footer">
        Outil non officiel · Les données restent sur cet appareil ·{' '}
        <a href="https://github.com/mattsaner/lycee-tracker">Code source</a>
      </footer>
    </HashRouter>
  );
}
