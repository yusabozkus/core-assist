import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from 'src/generated/prisma/client';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:4001',
  basePath: '/api/auth',
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [
    process.env.FRONTEND_URL || 'http://localhost:3001',
    'http://localhost:3001',
    'http://localhost:4001',
  ],
});
