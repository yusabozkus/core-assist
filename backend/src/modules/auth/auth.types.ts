import type { Request } from 'express';

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthenticatedSession = {
  id: string;
  userId: string;
  expiresAt: Date;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type RequestWithAuth = Request & {
  user?: AuthenticatedUser;
  session?: AuthenticatedSession;
};
