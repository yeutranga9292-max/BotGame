import { Module } from '@nestjs/common';
import { VocabService } from './vocab.service';
import { DictionaryService } from './dictionary.service';

@Module({
  providers: [VocabService, DictionaryService],
  exports: [VocabService, DictionaryService],
})
export class VocabModule {}
