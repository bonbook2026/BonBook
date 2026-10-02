import { PrismaClient } from '@prisma/client';
import { config } from './config';

const prisma = new PrismaClient();

async function main() {
  const sampleBooks = [
    { title: 'کتاب نمونه ۱', priceToman: config.book.priceToman, isActive: true },
    { title: 'کتاب نمونه ۲', priceToman: config.book.priceToman, isActive: true },
    { title: 'کتاب نمونه ۳', priceToman: config.book.priceToman, isActive: true },
  ];

  for (const book of sampleBooks) {
    await prisma.book.upsert({
      where: { id: sampleBooks.indexOf(book) + 1 },
      update: {},
      create: book,
    });
  }

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
