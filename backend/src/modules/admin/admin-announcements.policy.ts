import { createHash } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { WorkspaceRole } from '../../generated/prisma/enums';
import { resolveTeamAccessLevel } from '../team/team-access';
import { AnnouncementRole } from './dto/admin-announcement.dto';

export const announcementUserSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  ownedWorkspace: { select: { id: true, name: true } },
  workspaceMembers: {
    select: { role: true, workspace: { select: { id: true, name: true } } },
  },
  storeMembers: {
    select: { role: true, store: { select: { workspaceId: true } } },
  },
} satisfies Prisma.UserSelect;

type AudienceUser = Prisma.UserGetPayload<{
  select: typeof announcementUserSelect;
}>;

export function selectAnnouncementAudience(
  users: AudienceUser[],
  roles: readonly string[],
  adminEmails: readonly string[],
) {
  const admins = new Set(
    adminEmails.map((email) => email.trim().toLowerCase()),
  );
  const result = new Map<
    string,
    {
      userId: string;
      name: string;
      email: string;
      emailVerified: boolean;
      workspaceId: string;
      workspaceName: string;
      role: AnnouncementRole;
    }
  >();
  for (const user of users) {
    if (admins.has(user.email.trim().toLowerCase())) continue;
    const membership = user.workspaceMembers[0];
    const workspace = user.ownedWorkspace ?? membership?.workspace;
    if (!workspace) continue;
    const role = resolveTeamAccessLevel(
      user.ownedWorkspace ? WorkspaceRole.OWNER : membership.role,
      user.storeMembers.filter(
        (access) => access.store.workspaceId === workspace.id,
      ),
    ) as AnnouncementRole;
    if (!roles.includes(role)) continue;
    result.set(user.id, {
      userId: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      role,
    });
  }
  return [...result.values()].sort((a, b) => a.userId.localeCompare(b.userId));
}

export function announcementAudienceHash(
  audience: ReturnType<typeof selectAnnouncementAudience>,
) {
  return createHash('sha256').update(JSON.stringify(audience)).digest('hex');
}
