import { Injectable } from '@nestjs/common';
import { Difficulty, Word } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface VocabFilter {
  topic?: string;
  difficulty?: Difficulty;
}

@Injectable()
export class VocabService {
  constructor(private readonly prisma: PrismaService) {}

  async listTopics(): Promise<string[]> {
    const rows = await this.prisma.word.findMany({
      distinct: ['topic'],
      select: { topic: true },
      orderBy: { topic: 'asc' },
    });
    return rows.map((r) => r.topic);
  }

  async findByText(text: string): Promise<Word | null> {
    return this.prisma.word.findUnique({ where: { text: text.toLowerCase() } });
  }

  async randomWord(filter: VocabFilter = {}): Promise<Word | null> {
    const where = {
      ...(filter.topic ? { topic: filter.topic } : {}),
      ...(filter.difficulty ? { difficulty: filter.difficulty } : {}),
    };
    const total = await this.prisma.word.count({ where });
    if (total === 0) return null;
    const skip = Math.floor(Math.random() * total);
    const [word] = await this.prisma.word.findMany({ where, skip, take: 1 });
    return word ?? null;
  }

  async randomWords(count: number, filter: VocabFilter = {}): Promise<Word[]> {
    const where = {
      ...(filter.topic ? { topic: filter.topic } : {}),
      ...(filter.difficulty ? { difficulty: filter.difficulty } : {}),
    };
    const total = await this.prisma.word.count({ where });
    if (total === 0) return [];
    const take = Math.min(count, total);
    const indices = new Set<number>();
    while (indices.size < take) {
      indices.add(Math.floor(Math.random() * total));
    }
    const words: Word[] = [];
    for (const idx of indices) {
      const [w] = await this.prisma.word.findMany({ where, skip: idx, take: 1 });
      if (w) words.push(w);
    }
    return words;
  }

  async upsertWord(input: Omit<Word, 'id' | 'createdAt' | 'updatedAt'>): Promise<Word> {
    return this.prisma.word.upsert({
      where: { text: input.text.toLowerCase() },
      create: { ...input, text: input.text.toLowerCase() },
      update: { ...input, text: input.text.toLowerCase() },
    });
  }
}
