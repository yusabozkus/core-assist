import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

@Injectable()
export class CredentialsEncryptionService {
  private readonly key: Buffer;

  constructor() {
    const configuredKey = process.env.INTEGRATION_CREDENTIALS_KEY?.trim();

    if (configuredKey) {
      const decodedKey = Buffer.from(configuredKey, 'base64');

      if (decodedKey.length !== 32) {
        throw new Error(
          'INTEGRATION_CREDENTIALS_KEY must be a base64 encoded 32-byte key.',
        );
      }

      this.key = decodedKey;
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'INTEGRATION_CREDENTIALS_KEY environment variable is required in production.',
      );
    }

    const developmentSecret =
      process.env.BETTER_AUTH_SECRET ?? 'coreassist-development-only';
    this.key = createHash('sha256')
      .update(`${developmentSecret}:integration-credentials`)
      .digest();
  }

  encrypt(credentials: Record<string, string>): string {
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, initializationVector);
    const plaintext = JSON.stringify(credentials);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authenticationTag = cipher.getAuthTag();

    return [
      VERSION,
      initializationVector.toString('base64url'),
      authenticationTag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  decrypt(payload: string): Record<string, string> {
    const [version, encodedIv, encodedTag, encodedCiphertext] =
      payload.split('.');

    if (
      version !== VERSION ||
      !encodedIv ||
      !encodedTag ||
      !encodedCiphertext
    ) {
      throw new Error('Encrypted integration credentials are invalid.');
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(encodedIv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    const parsed = JSON.parse(plaintext) as unknown;

    if (!isStringRecord(parsed)) {
      throw new Error('Decrypted integration credentials are invalid.');
    }

    return parsed;
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === 'string')
  );
}
