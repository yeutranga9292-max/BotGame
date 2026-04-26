import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { CommandHandler } from './command.handler';
import { VocabModule } from '../vocab/vocab.module';
import { QuizModule } from '../quiz/quiz.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [VocabModule, QuizModule, UserModule],
  providers: [BotService, CommandHandler],
  exports: [BotService],
})
export class BotModule {}
