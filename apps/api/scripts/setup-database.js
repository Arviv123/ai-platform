const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupDatabase() {
  try {
    console.log('🔄 Setting up database...');
    
    // Check if users table exists
    try {
      const userCount = await prisma.user.count();
      console.log('✅ Users table exists with', userCount, 'records');
    } catch (error) {
      console.log('❌ Users table does not exist:', error.message);
      
      // Try to create tables manually if migration failed
      console.log('🔧 Attempting to create tables manually...');
      
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "users" (
          "id" TEXT NOT NULL,
          "email" TEXT NOT NULL UNIQUE,
          "password" TEXT NOT NULL,
          "firstName" TEXT,
          "lastName" TEXT,
          "role" TEXT NOT NULL DEFAULT 'USER',
          "organizationId" TEXT,
          "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
          "mfaSecret" TEXT,
          "mfaBackupCodes" TEXT,
          "emailVerified" BOOLEAN NOT NULL DEFAULT false,
          "emailVerificationToken" TEXT,
          "passwordResetToken" TEXT,
          "passwordResetExpires" TIMESTAMP(3),
          "lastLogin" TIMESTAMP(3),
          "loginAttempts" INTEGER NOT NULL DEFAULT 0,
          "lockUntil" TIMESTAMP(3),
          "preferences" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          
          CONSTRAINT "users_pkey" PRIMARY KEY ("id")
        );
      `);
      
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "a2a_agents" (
          "id" TEXT NOT NULL,
          "agentId" TEXT NOT NULL UNIQUE,
          "name" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "capabilities" TEXT NOT NULL,
          "description" TEXT NOT NULL,
          "agentCard" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'active',
          "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          
          CONSTRAINT "a2a_agents_pkey" PRIMARY KEY ("id")
        );
      `);
      
      console.log('✅ Tables created successfully');
    }
    
    // Create demo admin user if it doesn't exist
    try {
      const adminUser = await prisma.user.findUnique({
        where: { email: 'admin@nedlan-ai.co.il' }
      });
      
      if (!adminUser) {
        console.log('👤 Creating admin user...');
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('Admin2024!', 12);
        
        await prisma.user.create({
          data: {
            id: 'admin-1',
            email: 'admin@nedlan-ai.co.il',
            password: hashedPassword,
            firstName: 'מנהל',
            lastName: 'נדל"ן AI',
            role: 'ADMIN'
          }
        });
        
        console.log('✅ Admin user created');
      } else {
        console.log('👤 Admin user already exists');
      }
    } catch (userError) {
      console.log('⚠️ Could not create admin user:', userError.message);
    }
    
    console.log('🎯 Database setup completed');
  } catch (error) {
    console.error('💥 Database setup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupDatabase();