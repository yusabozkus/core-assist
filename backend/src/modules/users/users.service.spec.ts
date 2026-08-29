import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const findUser = jest.fn();
  const updateUsers = jest.fn();
  const prisma = {
    user: {
      findUnique: findUser,
      updateMany: updateUsers,
    },
  } as unknown as PrismaService;
  const service = new UsersService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates only the authenticated user name', async () => {
    const updatedUser = {
      id: 'user-1',
      name: 'Yeni İsim',
      email: 'user@example.com',
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    updateUsers.mockResolvedValue({ count: 1 });
    findUser.mockResolvedValue(updatedUser);

    await expect(
      service.updateProfile('user-1', { name: 'Yeni İsim' }),
    ).resolves.toEqual(updatedUser);
    expect(updateUsers).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'Yeni İsim' },
    });
  });

  it('returns not found when the authenticated user no longer exists', async () => {
    updateUsers.mockResolvedValue({ count: 0 });

    await expect(
      service.updateProfile('missing-user', { name: 'Yeni İsim' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
