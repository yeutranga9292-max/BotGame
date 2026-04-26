import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface DictionaryLookupResult {
  text: string;
  partOfSpeech?: string;
  ipa?: string;
  meaningEn: string;
  exampleEn?: string;
}

interface FreeDictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
  }[];
}

/**
 * Looks up a word using https://api.dictionaryapi.dev (Free Dictionary API).
 * No auth required. Used as a fallback when a word is not in our DB.
 */
@Injectable()
export class DictionaryService {
  private readonly logger = new Logger(DictionaryService.name);

  async lookup(word: string): Promise<DictionaryLookupResult | null> {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
      word.toLowerCase(),
    )}`;
    try {
      const { data } = await axios.get<FreeDictionaryEntry[]>(url, { timeout: 5000 });
      const entry = data?.[0];
      if (!entry) return null;
      const meaning = entry.meanings?.[0];
      const definition = meaning?.definitions?.[0];
      if (!definition) return null;
      return {
        text: entry.word,
        partOfSpeech: meaning.partOfSpeech,
        ipa: entry.phonetic ?? entry.phonetics?.find((p) => p.text)?.text,
        meaningEn: definition.definition,
        exampleEn: definition.example,
      };
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 404) return null;
      this.logger.warn(`Free Dictionary lookup failed for "${word}": ${(err as Error).message}`);
      return null;
    }
  }
}
