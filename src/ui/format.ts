export function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '–';
  return n.toFixed(digits).replace(/\.?0+$/, '') || '0';
}

/** Official half-point grades: "4", "4.5". */
export const fmtGrade = (n: number | null | undefined) => fmt(n, 1);

export function gradeTone(n: number | null | undefined): 'none' | 'fail' | 'low' | 'ok' | 'good' {
  if (n === null || n === undefined) return 'none';
  if (n < 2) return 'fail';
  if (n < 4) return 'low';
  if (n < 5) return 'ok';
  return 'good';
}

/** Parses "4.5" or "4,5"; returns undefined when empty, NaN when invalid. */
export function parseNumber(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return undefined;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export const isValidGrade = (n: number | undefined): n is number => n !== undefined && n >= 1 && n <= 6;
