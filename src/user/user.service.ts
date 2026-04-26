import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreate(input: {
    mezonUserId: string;
    username?: string;
    displayName?: string;
  }): Promise<User> {
    return this.prisma.user.upsert({
      where: { mezonUserId: input.mezonUserId },
      create: {
        mezonUserId: input.mezonUserId,
        username: input.username,
        displayName: input.displayName,
      },
      update: {
        username: input.username,
        displayName: input.displayName,
      },
    });
  }

  /**
   * Update the daily streak based on the user's last active date.
   * - Same day: no change.
   * - Yesterday: streak += 1.
   * - Otherwise: streak resets to 1.
   */
  async touchStreak(userId: string): Promise<User> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const today = startOfUtcDay(new Date());
    const last = user.lastActiveDate ? startOfUtcDay(user.lastActiveDate) : null;

    if (last && last.getTime() === today.getTime()) {
      return user;
    }

    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const newStreak = last && last.getTime() === yesterday.getTime() ? user.streakDays + 1 : 1;

    return this.prisma.user.update({
      where: { id: userId },
      data: { streakDays: newStreak, lastActiveDate: today },
    });
  }

  async recordAnswer(userId: string, correct: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totalAnswered: { increment: 1 },
        totalCorrect: { increment: correct ? 1 : 0 },
      },
    });
  }

  async setPreferredTopic(userId: string, topic: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { preferredTopic: topic },
    });
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
