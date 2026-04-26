import { Injectable, Logger } from '@nestjs/common';
import type { ChannelMessage } from 'mezon-sdk';
import { Word } from '@prisma/client';
import { MezonClientService } from '../mezon/mezon-client.service';
import { VocabService } from '../vocab/vocab.service';
import { DictionaryService } from '../vocab/dictionary.service';
import { QuizService } from '../quiz/quiz.service';
import { UserService } from '../user/user.service';

const LETTERS = ['A', 'B', 'C', 'D'];

@Injectable()
export class CommandHandler {
  private readonly logger = new Logger(CommandHandler.name);

  constructor(
    private readonly mezon: MezonClientService,
    private readonly vocab: VocabService,
    private readonly dictionary: DictionaryService,
    private readonly quiz: QuizService,
    private readonly users: UserService,
  ) {}

  async dispatch(command: string, args: string[], message: ChannelMessage): Promise<void> {
    const user = await this.users.findOrCreate({
      mezonUserId: message.sender_id,
      username: message.username ?? undefined,
      displayName: message.display_name ?? undefined,
    });

    switch (command) {
      case 'help':
      case 'h':
        return this.cmdHelp(message);
      case 'word':
      case 'w':
        return this.cmdWord(message, user.preferredTopic);
      case 'translate':
      case 't':
      case 'tra':
        return this.cmdTranslate(message, args.join(' '));
      case 'quiz':
      case 'q':
        return this.cmdQuiz(message, user.id, user.preferredTopic);
      case 'answer':
      case 'a':
        return this.cmdAnswer(message, user.id, args[0] ?? '');
      case 'topic':
      case 'learn':
        return this.cmdTopic(message, user.id, args[0]);
      case 'topics':
        return this.cmdTopics(message);
      case 'me':
      case 'stats':
        return this.cmdMe(message, user.id);
      case 'streak':
        return this.cmdStreak(message, user.id);
      default:
        return this.send(
          message,
          `Lệnh không nhận diện: \`${command}\`. Gõ \`!help\` để xem danh sách lệnh.`,
        );
    }
  }

  // ---- Commands ----

  private async cmdHelp(message: ChannelMessage) {
    const text = [
      '📚 **Mezon Vocab Bot** - các lệnh có sẵn:',
      '',
      '`!word` — Từ ngẫu nhiên kèm nghĩa, ví dụ',
      '`!translate <từ>` — Tra nghĩa của một từ tiếng Anh',
      '`!quiz` — Câu đố trắc nghiệm 4 lựa chọn (A/B/C/D)',
      '`!answer <A|B|C|D>` — Trả lời câu đố đang mở',
      '`!topic <tên>` — Đặt chủ đề (vd: common, business, travel, tech)',
      '`!topics` — Liệt kê các chủ đề',
      '`!me` — Xem thống kê cá nhân',
      '`!streak` — Xem chuỗi ngày học liên tục',
      '`!help` — Hiển thị trợ giúp này',
    ].join('\n');
    await this.send(message, text);
  }

  private async cmdWord(message: ChannelMessage, topic: string) {
    const word = await this.vocab.randomWord({ topic });
    if (!word) {
      await this.send(message, `Chưa có từ nào trong chủ đề **${topic}**.`);
      return;
    }
    await this.send(message, formatWord(word));
  }

  private async cmdTranslate(message: ChannelMessage, raw: string) {
    const text = raw.trim().toLowerCase();
    if (!text) {
      await this.send(message, 'Cú pháp: `!translate <từ>`');
      return;
    }

    const local = await this.vocab.findByText(text);
    if (local) {
      await this.send(message, formatWord(local));
      return;
    }

    const remote = await this.dictionary.lookup(text);
    if (!remote) {
      await this.send(message, `Không tìm thấy từ **${text}** trong từ điển.`);
      return;
    }

    const lines = [
      `🔎 **${remote.text}**${remote.partOfSpeech ? ` _(${remote.partOfSpeech})_` : ''}`,
      remote.ipa ? `Phát âm: ${remote.ipa}` : null,
      `Nghĩa: ${remote.meaningEn}`,
      remote.exampleEn ? `Ví dụ: _${remote.exampleEn}_` : null,
      '',
      '_Nguồn: Free Dictionary API. Chưa có bản dịch tiếng Việt._',
    ]
      .filter(Boolean)
      .join('\n');
    await this.send(message, lines);
  }

  private async cmdQuiz(message: ChannelMessage, userId: string, topic: string) {
    const built = await this.quiz.buildQuestion({
      userId,
      channelId: message.channel_id,
      topic,
    });
    if (!built) {
      await this.send(message, `Chủ đề **${topic}** chưa đủ từ để tạo quiz (cần ít nhất 4 từ).`);
      return;
    }
    const optionsText = built.options.map((opt, idx) => `**${LETTERS[idx]}.** ${opt}`).join('\n');
    const text = [
      `❓ **Quiz**`,
      built.prompt,
      '',
      optionsText,
      '',
      'Trả lời bằng `!answer A` / `!answer B` / `!answer C` / `!answer D`',
    ].join('\n');
    await this.send(message, text);
  }

  private async cmdAnswer(message: ChannelMessage, userId: string, answerArg: string) {
    if (!answerArg) {
      await this.send(message, 'Cú pháp: `!answer A` (hoặc B/C/D, hoặc 1-4)');
      return;
    }
    const session = await this.quiz.findOpenSession(userId, message.channel_id);
    if (!session) {
      await this.send(message, 'Bạn chưa có quiz nào đang mở. Gõ `!quiz` để bắt đầu.');
      return;
    }
    const result = await this.quiz.submitAnswer(session.id, answerArg);
    if (!result) {
      await this.send(message, 'Đáp án không hợp lệ. Hãy chọn A, B, C hoặc D.');
      return;
    }

    await this.users.recordAnswer(userId, result.correct);
    await this.users.touchStreak(userId);

    const correctLetter = LETTERS[result.answerIndex];
    const correctOption = result.question.options[result.answerIndex];

    if (result.correct) {
      await this.send(
        message,
        `✅ Chính xác! **${result.word.text}** = ${correctOption}\n_${result.word.exampleEn ?? ''}_`,
      );
    } else {
      await this.send(
        message,
        `❌ Sai rồi. Đáp án đúng là **${correctLetter}. ${correctOption}**.\n${formatWord(result.word)}`,
      );
    }
  }

  private async cmdTopic(message: ChannelMessage, userId: string, topic?: string) {
    if (!topic) {
      await this.send(message, 'Cú pháp: `!topic <tên>`. Xem danh sách bằng `!topics`.');
      return;
    }
    const known = await this.vocab.listTopics();
    if (!known.includes(topic)) {
      await this.send(message, `Chủ đề **${topic}** không tồn tại. Có sẵn: ${known.join(', ')}`);
      return;
    }
    await this.users.setPreferredTopic(userId, topic);
    await this.send(message, `Đã chuyển chủ đề học sang **${topic}**.`);
  }

  private async cmdTopics(message: ChannelMessage) {
    const topics = await this.vocab.listTopics();
    if (!topics.length) {
      await this.send(message, 'Chưa có chủ đề nào trong cơ sở dữ liệu.');
      return;
    }
    await this.send(message, `Các chủ đề có sẵn: ${topics.map((t) => `**${t}**`).join(', ')}`);
  }

  private async cmdMe(message: ChannelMessage, userId: string) {
    const user = await this.users.findOrCreate({ mezonUserId: message.sender_id });
    void userId;
    const accuracy = user.totalAnswered
      ? Math.round((user.totalCorrect / user.totalAnswered) * 100)
      : 0;
    const text = [
      `👤 **${user.displayName ?? user.username ?? user.mezonUserId}**`,
      `Chủ đề: **${user.preferredTopic}**`,
      `Đã trả lời: ${user.totalAnswered} câu — Đúng: ${user.totalCorrect} (${accuracy}%)`,
      `Streak hiện tại: 🔥 ${user.streakDays} ngày`,
    ].join('\n');
    await this.send(message, text);
  }

  private async cmdStreak(message: ChannelMessage, userId: string) {
    const user = await this.users.findOrCreate({ mezonUserId: message.sender_id });
    void userId;
    await this.send(
      message,
      `🔥 Streak của bạn: **${user.streakDays}** ngày liên tiếp.\n` +
        'Mỗi ngày trả lời ít nhất 1 quiz để giữ chuỗi.',
    );
  }

  // ---- Helpers ----

  private async send(message: ChannelMessage, text: string): Promise<void> {
    const client = this.mezon.getClientUnsafe();
    if (!client) return;
    try {
      const channel = await client.channels.fetch(message.channel_id);
      await channel.send({ t: text });
    } catch (err) {
      this.logger.error(`Failed to send reply: ${(err as Error).message}`);
    }
  }
}

function formatWord(word: Word): string {
  return [
    `📖 **${word.text}**${word.partOfSpeech ? ` _(${word.partOfSpeech})_` : ''}${
      word.ipa ? ` ${word.ipa}` : ''
    }`,
    `Nghĩa: ${word.meaningEn}`,
    `Tiếng Việt: ${word.meaningVi}`,
    word.exampleEn ? `Ví dụ: _${word.exampleEn}_` : null,
    word.exampleVi ? `Dịch: _${word.exampleVi}_` : null,
    `Chủ đề: \`${word.topic}\` • Độ khó: \`${word.difficulty}\``,
  ]
    .filter(Boolean)
    .join('\n');
}
