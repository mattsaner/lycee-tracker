import { describe, expect, it } from 'vitest';
import { createKey, isSealedBox, open, passwordProblem, seal, WrongPasswordError } from './vault';

describe('vault encryption', () => {
  it('round-trips data with the right password', async () => {
    const key = await createKey('correct horse');
    const box = await seal({ hello: 'élève', n: 4.5 }, key);
    expect(isSealedBox(box)).toBe(true);
    expect(box.data).not.toContain('hello');
    const { value } = await open(box, 'correct horse');
    expect(value).toEqual({ hello: 'élève', n: 4.5 });
  });

  it('refuses a wrong password', async () => {
    const box = await seal({ a: 1 }, await createKey('correct horse'));
    await expect(open(box, 'wrong horse')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('detects tampering (authenticated encryption)', async () => {
    const box = await seal({ a: 1 }, await createKey('correct horse'));
    const bytes = atob(box.data);
    const flipped = String.fromCharCode(bytes.charCodeAt(0) ^ 1) + bytes.slice(1);
    await expect(open({ ...box, data: btoa(flipped) }, 'correct horse')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('uses a fresh IV for every save and a fresh salt for every new key', async () => {
    const key = await createKey('correct horse');
    const [a, b] = [await seal({ a: 1 }, key), await seal({ a: 1 }, key)];
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
    expect((await createKey('correct horse')).salt).not.toBe(key.salt);
  });

  it('requires at least 8 characters', () => {
    expect(passwordProblem('1234567')).toMatch(/8 caractères/);
    expect(passwordProblem('12345678')).toBeNull();
  });
});
