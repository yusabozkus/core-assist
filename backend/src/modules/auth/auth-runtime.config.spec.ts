import assert from 'node:assert/strict';
import { test } from 'node:test';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { getCookies } from 'better-auth/cookies';
import { authRuntimeConfig } from './auth-runtime.config';

const production = {
  NODE_ENV: 'production',
  BETTER_AUTH_URL: 'https://api.coreasistan.com',
  FRONTEND_URL: 'https://coreasistan.com',
  AUTH_COOKIE_DOMAIN: 'coreasistan.com',
};

void test('production cookies reach both web and API with secure attributes', () => {
  const { options } = authRuntimeConfig(production);
  const cookie = getCookies(options).sessionToken;
  assert.equal(cookie.attributes.domain, 'coreasistan.com');
  assert.equal(cookie.attributes.secure, true);
  assert.equal(cookie.attributes.httpOnly, true);
  assert.equal(cookie.attributes.sameSite, 'lax');
  assert.equal(cookie.attributes.path, '/');
  assert.deepEqual(options.trustedOrigins, ['https://coreasistan.com']);
});

void test('localhost retains host-only cookies across different ports', () => {
  const { options } = authRuntimeConfig({ NODE_ENV: 'development' });
  const cookie = getCookies(options).sessionToken;
  assert.equal(options.baseURL, 'http://localhost:4001');
  assert.equal(cookie.attributes.domain, undefined);
  assert.equal(cookie.attributes.secure, false);
});

void test('same-host HTTPS deployment does not require a shared cookie', () => {
  const { options } = authRuntimeConfig({
    ...production,
    BETTER_AUTH_URL: production.FRONTEND_URL,
    AUTH_COOKIE_DOMAIN: '',
  });
  assert.equal(getCookies(options).sessionToken.attributes.domain, undefined);
  assert.equal(getCookies(options).sessionToken.attributes.secure, true);
});

void test('explicit staging scope is normalized without broadening to production', () => {
  const { options } = authRuntimeConfig({
    ...production,
    BETTER_AUTH_URL: 'https://api.staging.coreasistan.com',
    FRONTEND_URL: 'https://staging.coreasistan.com',
    AUTH_COOKIE_DOMAIN: ' .STAGING.coreasistan.com ',
  });
  assert.equal(
    getCookies(options).sessionToken.attributes.domain,
    'staging.coreasistan.com',
  );
});

void test('split hosts without a cookie domain fail early', () => {
  assert.throws(
    () => authRuntimeConfig({ ...production, AUTH_COOKIE_DOMAIN: '' }),
    /require AUTH_COOKIE_DOMAIN/,
  );
});

for (const domain of [
  'com',
  'co.uk',
  'github.io',
  'localhost',
  '127.0.0.1',
  'evilcoreasistan.com',
  'api.coreasistan.com',
  '*.coreasistan.com',
  'https://coreasistan.com',
  'coreasistan.com:443',
]) {
  void test(`rejects invalid or unshared cookie scope: ${domain}`, () => {
    assert.throws(
      () => authRuntimeConfig({ ...production, AUTH_COOKIE_DOMAIN: domain }),
      /AUTH_COOKIE_DOMAIN/,
    );
  });
}

void test('public and private suffixes are rejected even when both hosts match', () => {
  for (const domain of ['co.uk', 'github.io']) {
    assert.throws(
      () =>
        authRuntimeConfig({
          ...production,
          BETTER_AUTH_URL: `https://api.${domain}`,
          FRONTEND_URL: `https://app.${domain}`,
          AUTH_COOKIE_DOMAIN: domain,
        }),
      /AUTH_COOKIE_DOMAIN/,
    );
  }
});

void test('suffix lookalikes cannot share the cookie', () => {
  assert.throws(
    () =>
      authRuntimeConfig({
        ...production,
        FRONTEND_URL: 'https://evilcoreasistan.com',
      }),
    /AUTH_COOKIE_DOMAIN/,
  );
});

void test('production requires explicit HTTPS origins', () => {
  for (const key of ['BETTER_AUTH_URL', 'FRONTEND_URL']) {
    for (const value of [
      '',
      'http://coreasistan.com',
      'not-a-url',
      'https://coreasistan.com/path',
      'https://user:pass@coreasistan.com',
      'https://coreasistan.com/?foo=bar',
      'https://coreasistan.com/#fragment',
    ]) {
      assert.throws(
        () => authRuntimeConfig({ ...production, [key]: value }),
        new RegExp(key),
      );
    }
  }
});

void test('shared cookies require HTTPS even in development', () => {
  assert.throws(
    () =>
      authRuntimeConfig({
        ...production,
        NODE_ENV: 'development',
        BETTER_AUTH_URL: 'http://api.coreasistan.com',
      }),
    /require HTTPS/,
  );
});

void test('real auth handler creates, reads and revokes a shared-domain session', async () => {
  // Memory database and synthetic credentials: no OAuth, network or real users.
  const runtime = authRuntimeConfig(production).options;
  const auth = betterAuth({
    ...runtime,
    // Better Auth skips origin validation by default under NODE_ENV=test.
    // Exercise the production security contract in CI as well as locally.
    advanced: {
      ...runtime.advanced,
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },
    secret: 'local-auth-regression-test-secret-at-least-32-characters',
    database: memoryAdapter({
      user: [],
      session: [],
      account: [],
      verification: [],
    }),
    emailAndPassword: { enabled: true },
    session: { cookieCache: { enabled: false } },
    logger: { disabled: true },
  });
  const signup = await auth.handler(
    new Request(`${production.BETTER_AUTH_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: production.FRONTEND_URL,
      },
      body: JSON.stringify({
        name: 'Session Test',
        email: 'session@example.test',
        password: 'only-used-in-this-memory-test',
      }),
    }),
  );
  assert.equal(signup.status, 200);
  const setCookie = signup.headers
    .getSetCookie()
    .find((value) => value.startsWith('__Secure-better-auth.session_token='));
  assert.ok(setCookie);
  assert.match(setCookie, /Domain=coreasistan\.com/i);
  assert.match(setCookie, /; Secure/i);
  assert.match(setCookie, /; HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  const cookie = setCookie.split(';')[0];
  // Same Cookie forwarding used by the frontend server's get-session request.
  const getSession = () =>
    auth.handler(
      new Request(`${production.BETTER_AUTH_URL}/api/auth/get-session`, {
        headers: { Cookie: cookie },
      }),
    );
  const session = await getSession();
  assert.equal(session.status, 200);
  const data = (await session.json()) as { user: { email: string } };
  assert.equal(data.user.email, 'session@example.test');
  const signOut = (origin: string) =>
    auth.handler(
      new Request(`${production.BETTER_AUTH_URL}/api/auth/sign-out`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: '{}',
      }),
    );
  assert.equal((await signOut('https://attacker.example')).status, 403);
  // Sharing a cookie is not permission to make cross-origin mutations.
  assert.equal(
    (await signOut('https://untrusted.coreasistan.com')).status,
    403,
  );
  const logout = await signOut(production.FRONTEND_URL);
  assert.equal(logout.status, 200);
  const deletion = logout.headers
    .getSetCookie()
    .find((value) => value.startsWith('__Secure-better-auth.session_token='));
  assert.ok(deletion);
  assert.match(deletion, /Domain=coreasistan\.com/i);
  assert.match(deletion, /Max-Age=0/i);
  assert.equal(await (await getSession()).json(), null);
});
