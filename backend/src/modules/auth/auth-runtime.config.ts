import type { BetterAuthOptions } from 'better-auth';
import { getDomain } from 'tldts';

type AuthEnvironment = Partial<
  Pick<
    NodeJS.ProcessEnv,
    'NODE_ENV' | 'BETTER_AUTH_URL' | 'FRONTEND_URL' | 'AUTH_COOKIE_DOMAIN'
  >
>;

/** Keep browser login, server-rendered sessions and sign-out on the same scope. */
export function authRuntimeConfig(environment: AuthEnvironment = process.env) {
  const production = environment.NODE_ENV === 'production';
  const baseURL = readOrigin(
    environment.BETTER_AUTH_URL,
    'BETTER_AUTH_URL',
    production,
    'http://localhost:4001',
  );
  const frontendURL = readOrigin(
    environment.FRONTEND_URL,
    'FRONTEND_URL',
    production,
    'http://localhost:3001',
  );
  const api = new URL(baseURL);
  const frontend = new URL(frontendURL);
  const domain = environment.AUTH_COOKIE_DOMAIN?.trim()
    .toLowerCase()
    .replace(/^\./, '');
  const advanced: NonNullable<BetterAuthOptions['advanced']> = {};

  if (domain) {
    // Include private suffixes: sharing cookies across e.g. github.io tenants
    // is just as invalid as sharing them across all of co.uk.
    if (
      !/^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)+$/.test(
        domain,
      ) ||
      !getDomain(domain, { allowPrivateDomains: true }) ||
      !isWithinDomain(api.hostname, domain) ||
      !isWithinDomain(frontend.hostname, domain)
    ) {
      throw new Error(
        'AUTH_COOKIE_DOMAIN must be a registrable domain (or its subdomain) shared by BETTER_AUTH_URL and FRONTEND_URL.',
      );
    }
    if (api.protocol !== 'https:' || frontend.protocol !== 'https:') {
      throw new Error('Shared auth cookies require HTTPS on both origins.');
    }
    advanced.crossSubDomainCookies = { enabled: true, domain };
    advanced.useSecureCookies = true;
  } else if (
    api.hostname !== frontend.hostname ||
    api.protocol !== frontend.protocol
  ) {
    throw new Error(
      'Different auth/frontend hosts require AUTH_COOKIE_DOMAIN and HTTPS. Use the same host for localhost development.',
    );
  }

  const trustedOrigins = new Set([frontendURL]);
  if (!production) trustedOrigins.add('http://localhost:3001');

  return {
    frontendURL,
    options: {
      baseURL,
      basePath: '/api/auth',
      advanced,
      trustedOrigins: [...trustedOrigins],
    } satisfies BetterAuthOptions,
  };
}

function isWithinDomain(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function readOrigin(
  configured: string | undefined,
  key: string,
  production: boolean,
  fallback: string,
) {
  const value = configured?.trim();
  if (!value && production) {
    throw new Error(`${key} environment variable is required in production.`);
  }
  let url: URL;
  try {
    url = new URL(value || fallback);
  } catch {
    throw new Error(`${key} must be a valid HTTP(S) origin.`);
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${key} must be an HTTP(S) origin without a path or credentials.`,
    );
  }
  if (production && url.protocol !== 'https:') {
    throw new Error(`${key} must use HTTPS in production.`);
  }
  return url.origin;
}
