import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  try {
    const users = await db.user.findMany({
      select: { id: true, username: true, password: true },
    });
    console.log('Users in database:');
    users.forEach((u) => {
      console.log(`- ${u.username}: ${u.password}`);
    });
  } finally {
    await db.$disconnect();
  }
}

main();
