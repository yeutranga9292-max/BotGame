import { Injectable, Logger } from '@nestjs/common';
import { QuizQuestion, QuizSession, Word } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VocabService } from '../vocab/vocab.service';

export type QuizKind = 'en2vi' | 'vi2en';

export interface BuiltQuestion {
  question: QuizQuestion;
  word: Word;
  prompt: string;
  options: string[];
  answerIndex: number;
}

const LETTER_INDEX: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vocab: VocabService,
  ) {}

  /**
   * Build a new quiz question for the given user and persist it as a session
   * so we can grade the user's answer later.
   */
  async buildQuestion(opts: {
    userId: string;
    channelId: string;
    topic?: string;
    kind?: QuizKind;
  }): Promise<BuiltQuestion | null> {
    const kind: QuizKind = opts.kind ?? (Math.random() < 0.5 ? 'en2vi' : 'vi2en');
    const word = await this.vocab.randomWord({ topic: opts.topic });
    if (!word) return null;

    // Pick three more distinct words for distractors.
    const distractorPool = await this.vocab.randomWords(8, { topic: opts.topic });
    const distractors: Word[] = [];
    for (const w of distractorPool) {
      if (w.id === word.id) continue;
      if (distractors.length >= 3) break;
      distractors.push(w);
    }
    if (distractors.length < 3) return null;

    const choicesWords = shuffle([word, ...distractors]);
    const answerIndex = choicesWords.findIndex((w) => w.id === word.id);

    const prompt =
      kind === 'en2vi'
        ? `Nghĩa tiếng Việt của từ **${word.text}** là gì?`
        : `Từ tiếng Anh nào có nghĩa là **${word.meaningVi}**?`;

    const options =
      kind === 'en2vi' ? choicesWords.map((w) => w.meaningVi) : choicesWords.map((w) => w.text);

    const question = await this.prisma.quizQuestion.create({
      data: {
        wordId: word.id,
        prompt,
        options,
        answerIndex,
        kind,
      },
    });

    await this.prisma.quizSession.create({
      data: {
        userId: opts.userId,
        channelId: opts.channelId,
        questionId: question.id,
      },
    });

    return { question, word, prompt, options, answerIndex };
  }

  /**
   * Find the most recent un-answered session for a user in a channel.
   */
  async findOpenSession(
    userId: string,
    channelId: string,
  ): Promise<(QuizSession & { question: QuizQuestion }) | null> {
    return this.prisma.quizSession.findFirst({
      where: { userId, channelId, answeredAt: null },
      orderBy: { createdAt: 'desc' },
      include: { question: true },
    });
  }

  /**
   * Record the user's answer (by letter A/B/C/D or index) and return the result.
   */
  async submitAnswer(
    sessionId: string,
    rawAnswer: string,
  ): Promise<{
    correct: boolean;
    answerIndex: number;
    chosenIndex: number;
    question: QuizQuestion;
    word: Word;
  } | null> {
    const session = await this.prisma.quizSession.findUnique({
      where: { id: sessionId },
      include: { question: { include: { word: true } } },
    });
    if (!session || session.answeredAt) return null;

    const chosenIndex = parseAnswerIndex(rawAnswer);
    if (chosenIndex === null) return null;

    const correct = chosenIndex === session.question.answerIndex;
    await this.prisma.quizSession.update({
      where: { id: sessionId },
      data: { answeredAt: new Date(), isCorrect: correct },
    });

    return {
      correct,
      chosenIndex,
      answerIndex: session.question.answerIndex,
      question: session.question,
      word: session.question.word,
    };
  }
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function parseAnswerIndex(raw: string): number | null {
  const trimmed = raw.trim().toUpperCase();
  if (trimmed in LETTER_INDEX) return LETTER_INDEX[trimmed];
  const n = Number(trimmed);
  if (Number.isInteger(n) && n >= 1 && n <= 4) return n - 1;
  return null;
}
