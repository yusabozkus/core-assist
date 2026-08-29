import { Injectable } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaService } from '../../database/prisma.service';

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} environment variable is required.`);
  }

  return value;
}

function environmentURL(name: string, developmentFallback: string): string {
  const value = process.env[name]?.trim();

  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} environment variable is required in production.`);
  }

  return developmentFallback;
}

function createAppAuth(prisma: PrismaService) {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseURL = environmentURL('BETTER_AUTH_URL', 'http://localhost:4001');
  const frontendURL = environmentURL('FRONTEND_URL', 'http://localhost:3001');
  const trustedOrigins = new Set([frontendURL]);

  if (!isProduction) {
    trustedOrigins.add('http://localhost:3001');
  }

  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    secret: requiredEnvironmentVariable('BETTER_AUTH_SECRET'),
    baseURL,
    basePath: '/api/auth',
    account: {
      encryptOAuthTokens: true,
    },
    socialProviders: {
      google: {
        clientId: requiredEnvironmentVariable('GOOGLE_CLIENT_ID'),
        clientSecret: requiredEnvironmentVariable('GOOGLE_CLIENT_SECRET'),
      },
    },
    trustedOrigins: [...trustedOrigins],
  });
}

type AppAuth = ReturnType<typeof createAppAuth>;

@Injectable()
export class AuthService {
  readonly auth: AppAuth;

  constructor(prisma: PrismaService) {
    this.auth = createAppAuth(prisma);
  }
}
