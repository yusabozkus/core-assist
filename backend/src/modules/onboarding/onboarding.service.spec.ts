import { PrismaService } from '../../database/prisma.service';
import { StoreRole, WorkspaceRole } from '../../generated/prisma/enums';
import { OnboardingService } from './onboarding.service';

type WorkspaceCreateInput = {
  data: {
    name: string;
    ownerId: string;
    members: {
      create: { userId: string; role: WorkspaceRole };
    };
  };
  include: unknown;
};

type StoreCreateInput = {
  data: {
    name: string;
    workspaceId: string;
    members: {
      create: { userId: string; role: StoreRole };
    };
  };
  include: unknown;
};

describe('OnboardingService', () => {
  it('creates the internal workspace from the store name without exposing it', async () => {
    const findWorkspace = jest.fn().mockResolvedValue(null);
    let workspaceCreateInput: WorkspaceCreateInput | undefined;
    const createWorkspace = jest.fn((input: WorkspaceCreateInput) => {
      workspaceCreateInput = input;
      return Promise.resolve({
        id: 'workspace-1',
        name: 'North Clothing',
        stores: [],
      });
    });
    let storeCreateInput: StoreCreateInput | undefined;
    const createStore = jest.fn((input: StoreCreateInput) => {
      storeCreateInput = input;
      return Promise.resolve({
        id: 'store-1',
        name: 'North Clothing',
        channelConnections: [],
      });
    });
    const transaction = {
      workspace: {
        findFirst: findWorkspace,
        create: createWorkspace,
      },
      store: { create: createStore },
    };
    const runTransaction = jest.fn(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );
    const prisma = {
      $transaction: runTransaction,
    } as unknown as PrismaService;
    const service = new OnboardingService(prisma);

    const result = await service.complete('user-1', {
      storeName: 'North Clothing',
    });

    expect(createWorkspace).toHaveBeenCalledTimes(1);
    expect(workspaceCreateInput).toHaveProperty('data', {
      name: 'North Clothing',
      ownerId: 'user-1',
      members: {
        create: {
          userId: 'user-1',
          role: WorkspaceRole.OWNER,
        },
      },
    });
    expect(createStore).toHaveBeenCalledTimes(1);
    expect(storeCreateInput).toHaveProperty('data', {
      name: 'North Clothing',
      workspaceId: 'workspace-1',
      members: {
        create: {
          userId: 'user-1',
          role: StoreRole.OWNER,
        },
      },
    });
    expect(result).not.toHaveProperty('workspace');
    expect(result).toMatchObject({
      completed: true,
      created: { store: true },
      store: { id: 'store-1', name: 'North Clothing' },
    });
  });
});
