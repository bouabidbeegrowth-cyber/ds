import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { username: true, password: true, role: true, roleId: true, active: true },
    orderBy: { username: 'asc' },
  });

  console.log(JSON.stringify(users, null, 2));
  console.log('admin123 sha256=', crypto.createHash('sha256').update('admin123').digest('hex'));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
