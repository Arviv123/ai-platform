const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user - מנהל הפלטפורמה
  const adminPassword = await bcrypt.hash('Admin2024!', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nedlan-ai.co.il' },
    update: {},
    create: {
      email: 'admin@nedlan-ai.co.il',
      password: adminPassword,
      firstName: 'מנהל',
      lastName: 'נדל"ן AI',
      role: 'ADMIN',
      emailVerified: true
    }
  });

  console.log('✅ Admin user created:', admin.email);

  // Create professional users - משתמשים מקצועיים
  const professionalUsers = [
    {
      email: 'architect@nedlan-ai.co.il',
      firstName: 'אדריכל',
      lastName: 'מקצועי',
      password: 'Architect2024!'
    },
    {
      email: 'planner@nedlan-ai.co.il', 
      firstName: 'מתכנן',
      lastName: 'עירוני',
      password: 'Planner2024!'
    },
    {
      email: 'contractor@nedlan-ai.co.il',
      firstName: 'קבלן',
      lastName: 'בנייה',
      password: 'Builder2024!'
    },
    {
      email: 'investor@nedlan-ai.co.il',
      firstName: 'משקיע',
      lastName: 'נדלן',
      password: 'Investor2024!'
    }
  ];

  for (const userData of professionalUsers) {
    const userPassword = await bcrypt.hash(userData.password, 12);
    
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: userPassword,
        role: 'USER',
        emailVerified: true
      }
    });

    console.log('✅ Professional user created:', user.email);
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