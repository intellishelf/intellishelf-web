import { randomBytes, randomUUID } from 'node:crypto';

export type TestAccount = { email: string; password: string };

// Synthetic, per-run account; the API only requires a valid email and 6+ characters.
export function newTestAccount(): TestAccount {
  return {
    email: ['e2e+', randomUUID(), '@example.test'].join(''),
    password: randomBytes(18).toString('base64url'),
  };
}
