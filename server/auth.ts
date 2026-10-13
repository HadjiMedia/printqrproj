import crypto from 'node:crypto';

export interface HashedPassword {
  hash: string;
  salt: string;
}

/**
 * Derives a cryptographic scrypt hash from a password string with a random salt.
 */
export function hashPassword(password: string): HashedPassword {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

/**
 * Constant-time password verification using timingSafeEqual.
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const hashBuf = Buffer.from(hash, 'hex');
    const compBuf = Buffer.from(computedHash, 'hex');
    if (hashBuf.length !== compBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, compBuf);
  } catch {
    return false;
  }
}

/**
 * Generates an opaque random token for admin session or tracking token.
 */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Validates a Master Recovery Key against the environment variable.
 */
export function verifyMasterRecoveryKey(key: string): boolean {
  const envKey = (process.env.MASTER_RECOVERY_KEY || '').trim();
  if (!envKey) return false;
  try {
    const a = Buffer.from(key.trim());
    const b = Buffer.from(envKey);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
