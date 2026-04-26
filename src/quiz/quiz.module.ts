import { Module } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { VocabModule } from '../vocab/vocab.module';

@Module({
  imports: [VocabModule],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
