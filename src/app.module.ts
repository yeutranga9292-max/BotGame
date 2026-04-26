import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { MezonModule } from './mezon/mezon.module';
import { VocabModule } from './vocab/vocab.module';
import { QuizModule } from './quiz/quiz.module';
import { UserModule } from './user/user.module';
import { BotModule } from './bot/bot.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MezonModule,
    VocabModule,
    QuizModule,
    UserModule,
    BotModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
