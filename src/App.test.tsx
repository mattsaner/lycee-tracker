import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { useStore } from './store/store';

function addTest(card: HTMLElement, grade: string, weight = '1') {
  fireEvent.change(within(card).getByLabelText('Nouvelle note'), { target: { value: grade } });
  fireEvent.change(within(card).getByLabelText('Poids', { selector: '.add-test input' }), { target: { value: weight } });
  fireEvent.click(within(card).getByRole('button', { name: 'Ajouter' }));
}

const card = (name: string) => screen.getByText(name, { selector: '.discipline-name' }).closest('details') as HTMLElement;

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState({ profiles: [] });
    window.location.hash = '#/';
  });
  afterEach(cleanup);

  it('creates a profile, records grades and shows promotion', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('+ Nouveau profil'));
    fireEvent.change(screen.getByLabelText('Prénom ou pseudo'), { target: { value: 'Léa' } });
    fireEvent.change(screen.getByLabelText('Option spécifique (OS)'), { target: { value: 'bc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer le profil' }));

    expect(await screen.findByRole('heading', { name: 'Léa' })).toBeTruthy();
    // Science OS → 6 h of maths in 1re, OC not taught yet
    expect(within(card('Mathématiques')).getByText(/6 h/)).toBeTruthy();
    expect(screen.queryByText(/^OC /, { selector: '.discipline-name' })).toBeNull();

    act(() => {
      fireEvent.click(screen.getByText('1er semestre'));
    });
    addTest(card('Français'), '4,5');
    addTest(card('Français'), '5.2', '2');
    // (4.5 + 10.4) / 3 = 4.97 → 5
    expect(within(card('Français')).getByText('S1 4.97')).toBeTruthy();
    expect(within(card('Français')).getByText('5', { selector: '.badge' })).toBeTruthy();

    addTest(card('Mathématiques'), '3');
    expect(within(card('Mathématiques')).getByText('3', { selector: '.badge' })).toBeTruthy();

    // Invalid grade is rejected
    addTest(card('Chimie'), '7');
    expect(within(card('Chimie')).getByText('La note doit être entre 1 et 6.')).toBeTruthy();

    fireEvent.click(screen.getByText('Bilan & promotion'));
    // surplus 1 (français 5) < 2 × deficit 2 (maths 3) → fails
    expect(await screen.findByText('Conditions de promotion non remplies')).toBeTruthy();
    expect(screen.getByText('provisoire')).toBeTruthy();

    fireEvent.click(screen.getByText('Maturité'));
    expect(await screen.findByText('Travail de maturité')).toBeTruthy();

    // Data persisted to localStorage
    const saved = JSON.parse(localStorage.getItem('lycee-tracker')!);
    expect(saved.state.profiles[0].years[0].tests).toHaveLength(3);
  });
});
