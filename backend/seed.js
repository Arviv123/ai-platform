const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin2024!', 10);

  const user = await prisma.user.upsert({
    where: { email: 'admin@nedlan-ai.co.il' },
    update: {},
    create: {
      email: 'admin@nedlan-ai.co.il',
      password: passwordHash,
      role: 'ADMIN', // הסר שורה זו אם אין שדה כזה
    },
  });

  console.log('✅ Admin user created:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
