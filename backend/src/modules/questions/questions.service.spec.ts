import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StoreRole } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import type { QuestionSyncDispatcher } from '../question-sync/question-sync.types';
import { QuestionsService } from './questions.service';

describe('QuestionsService', () => {
  const findMembership = jest.fn();
  const findQuestions = jest.fn();
  const findConnections = jest.fn();
  const enqueue = jest.fn();
  const prisma = {
    storeMember: { findUnique: findMembership },
    productQuestion: { findMany: findQuestions },
    channelConnection: { findMany: findConnections },
  } as unknown as PrismaService;
  const dispatcher = { enqueue } as unknown as QuestionSyncDispatcher;
  const service = new QuestionsService(prisma, dispatcher);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists questions only for store members', async () => {
    findMembership.mockResolvedValue({ role: StoreRole.AGENT });
    findQuestions.mockResolvedValue([{ id: 'question-1' }]);

    await expect(service.findAll('store-1', 'user-1')).resolves.toEqual([
      { id: 'question-1' },
    ]);
    expect(findQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: 'store-1' } }),
    );
  });

  it('does not expose another stores questions', async () => {
    findMembership.mockResolvedValue(null);

    await expect(service.findAll('store-2', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findQuestions).not.toHaveBeenCalled();
  });

  it('queues connected commerce channels only for managers', async () => {
    findMembership.mockResolvedValue({ role: StoreRole.OWNER });
    findConnections.mockResolvedValue([{ id: 'connection-1' }]);
    enqueue.mockResolvedValue({ status: 'RUNNING' });

    await expect(service.sync('store-1', 'user-1')).resolves.toEqual({
      status: 'RUNNING',
      queued: 1,
      skipped: 0,
    });
    expect(enqueue).toHaveBeenCalledWith('store-1', 'connection-1');

    findMembership.mockResolvedValue({ role: StoreRole.AGENT });
    await expect(service.sync('store-1', 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
