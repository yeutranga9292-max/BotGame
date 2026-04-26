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

async function main() {
  const dataPath = path.join(__dirname, 'data', 'words.json');
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const words: WordSeed[] = JSON.parse(raw);

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
