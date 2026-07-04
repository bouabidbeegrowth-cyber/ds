import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Function to hash password using SHA-256 (matching the auth route)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function main() {
  console.log('Starting database seed...');

  // Create roles with basic permissions
  const adminRole = await prisma.role.upsert({
    where: { name: 'Administrateur' },
    update: {
      permissions: JSON.stringify({
        clients: 'full',
        services: 'full',
        appointments: 'full',
        invoices: 'full',
        purchases: 'full',
        expenses: 'full',
        users: 'full',
        dashboard: 'full',
        journal: 'full',
        caisse: 'full'
      }),
      isSystem: true,
    },
    create: {
      name: 'Administrateur',
      permissions: JSON.stringify({
        clients: 'full',
        services: 'full',
        appointments: 'full',
        invoices: 'full',
        purchases: 'full',
        expenses: 'full',
        users: 'full',
        dashboard: 'full',
        journal: 'full',
        caisse: 'full'
      }),
      isSystem: true,
    },
  });

  const employeeRole = await prisma.role.upsert({
    where: { name: 'Employé' },
    update: {
      permissions: JSON.stringify({
        clients: 'read',
        services: 'read',
        appointments: 'full',
        invoices: 'read',
        purchases: 'none',
        expenses: 'none',
        users: 'none',
        dashboard: 'read',
        journal: 'none',
        caisse: 'none'
      }),
      isSystem: true,
    },
    create: {
      name: 'Employé',
      permissions: JSON.stringify({
        clients: 'read',
        services: 'read',
        appointments: 'full',
        invoices: 'read',
        purchases: 'none',
        expenses: 'none',
        users: 'none',
        dashboard: 'read',
        journal: 'none',
        caisse: 'none'
      }),
      isSystem: true,
    },
  });

  console.log('✓ Roles created:', { adminRole: adminRole.name, employeeRole: employeeRole.name });

  // Create admin user with SHA-256 hashed password
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      password: await hashPassword('admin123'),
      name: 'Administrator',
      roleId: adminRole.id,
      active: true,
      role: 'ADMIN',
    },
    create: {
      username: 'admin',
      password: await hashPassword('admin123'),
      name: 'Administrator',
      roleId: adminRole.id,
      active: true,
      role: 'ADMIN',
    },
  });

  // Create employee user with SHA-256 hashed password
  const employeeUser = await prisma.user.upsert({
    where: { username: 'employee' },
    update: {
      password: await hashPassword('employee123'),
      name: 'Employee User',
      roleId: employeeRole.id,
      active: true,
      role: 'EMPLOYEE',
    },
    create: {
      username: 'employee',
      password: await hashPassword('employee123'),
      name: 'Employee User',
      roleId: employeeRole.id,
      active: true,
      role: 'EMPLOYEE',
    },
  });

  console.log('✓ Users created:');
  console.log('  - Admin: admin (password: admin123)');
  console.log('  - Employee: employee (password: employee123)');

  // Create sample client
  const sampleClient = await prisma.client.upsert({
    where: { id: 'sample-client-1' },
    update: {},
    create: {
      id: 'sample-client-1',
      firstName: 'John',
      lastName: 'Doe',
      phone: '555-1234',
      email: 'john@example.com',
      address: '123 Main St',
      remarks: 'No allergies',
    },
  });

  console.log('✓ Sample client created:', sampleClient.firstName + ' ' + sampleClient.lastName);

  // Create sample service
  const sampleService = await prisma.service.upsert({
    where: { id: 'sample-service-1' },
    update: {},
    create: {
      id: 'sample-service-1',
      name: 'Haircut',
      description: 'Professional haircut service',
      price: 50,
      duration: 30,
      active: true,
    },
  });

  console.log('✓ Sample service created:', sampleService.name);

  console.log('\n✅ Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
