import { useEffect, useState } from 'react';
import { fmt, gradeTone, parseNumber } from './format';

interface Props {
  value: number | null | undefined;
  onCommit: (value: number | null) => void;
  placeholder?: string;
  label: string;
  /** Accepted range; grades by default. */
  min?: number;
  max?: number;
  className?: string;
}

/** Number field that accepts "4,5" or "4.5" and commits on blur or Enter. Empty clears the value. */
export function GradeField({ value, onCommit, placeholder, label, min = 1, max = 6, className }: Props) {
  const [text, setText] = useState(value == null ? '' : fmt(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(value == null ? '' : fmt(value));
    setInvalid(false);
  }, [value]);

  const commit = () => {
    const n = parseNumber(text);
    if (n === undefined) {
      setInvalid(false);
      if (value != null) onCommit(null);
      return;
    }
    const ok = !Number.isNaN(n) && n >= min && n <= max;
    setInvalid(!ok);
    if (ok && n !== value) onCommit(n);
  };

  return (
    <input
      className={`grade-field${invalid ? ' invalid' : ''}${className ? ` ${className}` : ''}`}
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid}
      title={invalid ? `Valeur entre ${min} et ${max}` : label}
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function GradeBadge({ value, title }: { value: number | null | undefined; title?: string }) {
  return (
    <span className={`badge tone-${gradeTone(value)}`} title={title}>
      {fmt(value)}
    </span>
  );
}
