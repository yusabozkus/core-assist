import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const publicProfileSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicProfileSelect,
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const result = await this.prisma.user.updateMany({
      where: { id: userId },
      data: { name: dto.name },
    });

    if (result.count === 0) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }

    return this.getProfile(userId);
  }
}
