import { ForbiddenException } from '@nestjs/common';
import { StoreRole, WorkspaceRole } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { StoresService } from './stores.service';

describe('StoresService', () => {
  const findMemberships = jest.fn();
  const findStores = jest.fn();
  const createStore = jest.fn();
  const prisma = {
    workspaceMember: { findMany: findMemberships },
    store: { findMany: findStores, create: createStore },
  } as unknown as PrismaService;
  const service = new StoresService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only stores the current user belongs to', async () => {
    findStores.mockResolvedValue([]);

    await service.findAllForUser('user-1');

    expect(findStores).toHaveBeenCalledWith({
      where: {
        members: { some: { userId: 'user-1' } },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });
  });

  it('does not promote a workspace admin to store owner', async () => {
    findMemberships.mockResolvedValue([
      { role: WorkspaceRole.ADMIN, workspaceId: 'workspace-1' },
    ]);
    createStore.mockResolvedValue({ id: 'store-1' });

    await service.create('user-1', {
      name: 'Demo Store',
    });

    expect(createStore).toHaveBeenCalledWith({
      data: {
        name: 'Demo Store',
        workspaceId: 'workspace-1',
        members: {
          create: {
            userId: 'user-1',
            role: StoreRole.ADMIN,
          },
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });
  });

  it('uses an owned workspace before an admin membership', async () => {
    findMemberships.mockResolvedValue([
      { role: WorkspaceRole.ADMIN, workspaceId: 'workspace-admin' },
      { role: WorkspaceRole.OWNER, workspaceId: 'workspace-owned' },
    ]);
    createStore.mockResolvedValue({ id: 'store-1' });

    await service.create('user-1', { name: 'Owned Store' });

    expect(createStore).toHaveBeenCalledWith({
      data: {
        name: 'Owned Store',
        workspaceId: 'workspace-owned',
        members: {
          create: { userId: 'user-1', role: StoreRole.OWNER },
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });
  });

  it('rejects store creation without an owner or admin membership', async () => {
    findMemberships.mockResolvedValue([]);

    await expect(
      service.create('user-1', { name: 'Demo Store' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createStore).not.toHaveBeenCalled();
  });
});
