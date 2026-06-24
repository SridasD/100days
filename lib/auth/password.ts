import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** RFC4648 random temporary password — 12 chars, mixed case + digits + symbol. */
export function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digit = '23456789';
  const symbol = '!@#$%^&*';
  const all = upper + lower + digit + symbol;
  const pick = (set: string) => set[crypto.randomInt(0, set.length)];
  let pw = pick(upper) + pick(lower) + pick(digit) + pick(symbol);
  for (let i = 0; i < 8; i++) pw += pick(all);
  return pw
    .split('')
    .sort(() => crypto.randomInt(0, 100) - 50)
    .join('');
}
