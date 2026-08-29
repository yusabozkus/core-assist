import { CredentialsEncryptionService } from './credentials-encryption.service';

describe('CredentialsEncryptionService', () => {
  const originalNodeEnvironment = process.env.NODE_ENV;
  const originalEncryptionKey = process.env.INTEGRATION_CREDENTIALS_KEY;
  const originalAuthSecret = process.env.BETTER_AUTH_SECRET;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.INTEGRATION_CREDENTIALS_KEY;
    process.env.BETTER_AUTH_SECRET = 'test-auth-secret';
  });

  afterAll(() => {
    restoreEnvironment('NODE_ENV', originalNodeEnvironment);
    restoreEnvironment('INTEGRATION_CREDENTIALS_KEY', originalEncryptionKey);
    restoreEnvironment('BETTER_AUTH_SECRET', originalAuthSecret);
  });

  it('encrypts credentials without exposing plaintext and decrypts them', () => {
    const service = new CredentialsEncryptionService();
    const credentials = { apiKey: 'seller-key', apiSecret: 'seller-secret' };

    const encrypted = service.encrypt(credentials);

    expect(encrypted).not.toContain('seller-key');
    expect(service.decrypt(encrypted)).toEqual(credentials);
  });

  it('rejects modified encrypted payloads', () => {
    const service = new CredentialsEncryptionService();
    const encrypted = service.encrypt({ apiKey: 'seller-key' });
    const tampered = `${encrypted.slice(0, -1)}x`;

    expect(() => service.decrypt(tampered)).toThrow();
  });
});

function restoreEnvironment(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
