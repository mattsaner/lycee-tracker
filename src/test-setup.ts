import { webcrypto } from 'node:crypto';
import { kdfConfig } from './crypto/vault';

// jsdom has no Web Crypto implementation; use Node's (same standard API as browsers).
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

// 600 000 PBKDF2 iterations are right for users but make tests slow.
kdfConfig.iterations = 1000;
