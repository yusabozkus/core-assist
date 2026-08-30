import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StoreRole } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import type { QuestionSyncDispatcher } from '../question-sync/question-sync.types';
import type { QuestionAnswerDispatcher } from '../question-answer/question-answer.types';
import { QuestionsService } from './questions.service';

describe('QuestionsService', () => {
  const findMembership = jest.fn();
  const findQuestions = jest.fn();
  const findConnections = jest.fn();
  const enqueue = jest.fn();
  const enqueueAnswer = jest.fn();
  const prisma = {
    storeMember: { findUnique: findMembership },
    productQuestion: { findMany: findQuestions },
    channelConnection: { findMany: findConnections },
  } as unknown as PrismaService;
  const dispatcher = { enqueue } as unknown as QuestionSyncDispatcher;
  const answerDispatcher = {
    enqueue: enqueueAnswer,
  } as unknown as QuestionAnswerDispatcher;
  const service = new QuestionsService(prisma, dispatcher, answerDispatcher);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists questions only for store members', async () => {
    findMembership.mockResolvedValue({ role: StoreRole.AGENT });
    findQuestions.mockResolvedValue([
      {
        id: 'question-1',
        product: {
          id: 'product-1',
          variants: [{ id: 'variant-1', price: '499.90' }],
        },
      },
    ]);

    await expect(service.findAll('store-1', 'user-1')).resolves.toEqual([
      {
        id: 'question-1',
        product: {
          id: 'product-1',
          variants: [{ id: 'variant-1', price: 499.9 }],
        },
      },
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

  it('allows agents to queue a manual answer but rejects viewers', async () => {
    findMembership.mockResolvedValue({ role: StoreRole.AGENT });
    enqueueAnswer.mockResolvedValue({ id: 'answer-1', status: 'QUEUED' });

    await expect(
      service.answer('store-1', 'question-1', 'user-1', 'Stokta mevcut.'),
    ).resolves.toEqual({ id: 'answer-1', status: 'QUEUED' });
    expect(enqueueAnswer).toHaveBeenCalledWith({
      storeId: 'store-1',
      questionId: 'question-1',
      requestedByUserId: 'user-1',
      answer: 'Stokta mevcut.',
    });

    findMembership.mockResolvedValue({ role: StoreRole.VIEWER });
    await expect(
      service.answer('store-1', 'question-1', 'user-1', 'Cevap'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
