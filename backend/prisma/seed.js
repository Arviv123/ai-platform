const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@platform.com' },
    update: {},
    create: {
      email: 'admin@platform.com',
      password: adminPassword,
      firstName: 'מנהל',
      lastName: 'המערכת',
      role: 'ADMIN',
      emailVerified: true
    }
  });

  console.log('✅ Admin user created:', admin.email);

  // Create demo users
  const demoUsers = [
    {
      email: 'user1@example.com',
      firstName: 'חיים',
      lastName: 'לוי'
    },
    {
      email: 'user2@demo.com',
      firstName: 'שרה',
      lastName: 'כהן'
    },
    {
      email: 'test@platform.com',
      firstName: 'יוסי',
      lastName: 'דוד'
    }
  ];

  for (const userData of demoUsers) {
    const userPassword = await bcrypt.hash('demo123', 12);
    
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        password: userPassword,
        role: 'USER',
        emailVerified: true
      }
    });

    console.log('✅ Demo user created:', user.email);
  }

  console.log('ℹ️ Basic user setup completed');

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });