import { StoreRole, WorkspaceRole } from '../../generated/prisma/enums';
import { TeamAccessLevel } from './dto/team-member-access.dto';

export type ResolvedTeamAccessLevel = 'OWNER' | TeamAccessLevel;

export function resolveTeamAccessLevel(
  workspaceRole: WorkspaceRole,
  accesses: ReadonlyArray<{ role: StoreRole }>,
): ResolvedTeamAccessLevel {
  if (
    workspaceRole === WorkspaceRole.OWNER ||
    accesses.some((access) => access.role === StoreRole.OWNER)
  ) {
    return 'OWNER';
  }
  if (workspaceRole === WorkspaceRole.ADMIN) {
    return TeamAccessLevel.ACCOUNT_ADMIN;
  }
  if (accesses.some((access) => access.role === StoreRole.ADMIN)) {
    return TeamAccessLevel.STORE_ADMIN;
  }
  if (accesses.some((access) => access.role === StoreRole.AGENT)) {
    return TeamAccessLevel.AGENT;
  }
  return TeamAccessLevel.VIEWER;
}
