import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany({
    select: { name: true, permissions: true, isSystem: true },
    orderBy: { name: 'asc' },
  });

  console.log(JSON.stringify(roles, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
