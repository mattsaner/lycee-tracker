import type { ReactNode } from 'react';
import { MAX_INSUFFICIENT, MIN_GRADE, type RuleCheck } from '../../domain/rules';
import { fmt } from '../../ui/format';

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={ok ? 'ok' : 'ko'}>
      <span aria-hidden>{ok ? '✓' : '✗'}</span> {children}
    </li>
  );
}

export function RuleChecks({ check }: { check: RuleCheck }) {
  const doubled = 2 * check.deficit;
  const max = Math.max(check.surplus, doubled, 0.5);
  return (
    <>
      <ul className="checks">
        <Check ok={check.compensationOk}>
          Double compensation : points au-dessus de 4 <strong>{fmt(check.surplus)}</strong> ≥ 2 × points manquants{' '}
          <strong>{fmt(doubled)}</strong>{' '}
          <span className="muted">
            (marge {check.margin >= 0 ? '+' : ''}
            {fmt(check.margin)})
          </span>
        </Check>
        <Check ok={check.countOk}>
          Notes insuffisantes : <strong>{check.insufficientCount}</strong> / {MAX_INSUFFICIENT} max.
        </Check>
        <Check ok={check.minimumOk}>
          Note la plus basse : <strong>{fmt(check.lowest)}</strong> (minimum {MIN_GRADE})
        </Check>
      </ul>
      <div className="gauge" aria-hidden>
        <div className="gauge-row">
          <span>Points +</span>
          <div className="bar">
            <div className="fill good" style={{ width: `${(check.surplus / max) * 100}%` }} />
          </div>
        </div>
        <div className="gauge-row">
          <span>2 × points −</span>
          <div className="bar">
            <div className="fill bad" style={{ width: `${(doubled / max) * 100}%` }} />
          </div>
        </div>
      </div>
    </>
  );
}
