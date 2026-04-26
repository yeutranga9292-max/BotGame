import { PrismaClient, Difficulty } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface WordSeed {
  text: string;
  partOfSpeech?: string;
  ipa?: string;
  meaningEn: string;
  meaningVi: string;
  exampleEn?: string;
  exampleVi?: string;
  topic?: string;
  difficulty?: keyof typeof Difficulty;
}

function loadWords(): WordSeed[] {
  const wordsDir = path.join(__dirname, 'data', 'words');
  const legacyFile = path.join(__dirname, 'data', 'words.json');
  const all: WordSeed[] = [];

  if (fs.existsSync(wordsDir)) {
    const files = fs
      .readdirSync(wordsDir)
      .filter((f) => f.endsWith('.json'))
      .sort();
    for (const f of files) {
      const raw = fs.readFileSync(path.join(wordsDir, f), 'utf-8');
      const part: WordSeed[] = JSON.parse(raw);
      all.push(...part);
      console.log(`  - ${f}: ${part.length} words`);
    }
  } else if (fs.existsSync(legacyFile)) {
    const raw = fs.readFileSync(legacyFile, 'utf-8');
    all.push(...(JSON.parse(raw) as WordSeed[]));
  }

  return all;
}

async function main() {
  const words = loadWords();

  console.log(`Seeding ${words.length} words...`);

  for (const w of words) {
    await prisma.word.upsert({
      where: { text: w.text.toLowerCase() },
      create: {
        text: w.text.toLowerCase(),
        partOfSpeech: w.partOfSpeech,
        ipa: w.ipa,
        meaningEn: w.meaningEn,
        meaningVi: w.meaningVi,
        exampleEn: w.exampleEn,
        exampleVi: w.exampleVi,
        topic: w.topic ?? 'common',
        difficulty: (w.difficulty as Difficulty) ?? Difficulty.EASY,
      },
      update: {
        partOfSpeech: w.partOfSpeech,
        ipa: w.ipa,
        meaningEn: w.meaningEn,
        meaningVi: w.meaningVi,
        exampleEn: w.exampleEn,
        exampleVi: w.exampleVi,
        topic: w.topic ?? 'common',
        difficulty: (w.difficulty as Difficulty) ?? Difficulty.EASY,
      },
    });
  }

  const total = await prisma.word.count();
  console.log(`Done. Database now has ${total} words.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
