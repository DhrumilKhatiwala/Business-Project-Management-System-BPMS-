require('dotenv').config();
const prisma = require('./src/utils/prisma');

async function migrate() {
  console.log('🔄 Starting safe tenancy migration...');

  // 1. Ensure Company for Sarah Jenkins
  const sarah = await prisma.user.findUnique({ where: { email: 'owner@bpms.com' } });
  let sarahCompany;
  if (sarah) {
    sarahCompany = await prisma.company.findUnique({ where: { ownerId: sarah.id } });
    if (!sarahCompany) {
      sarahCompany = await prisma.company.create({
        data: {
          name: 'Jenkins Construction & Interiors',
          description: 'Commercial and residential construction management',
          ownerId: sarah.id,
        },
      });
      console.log('✅ Created company for Sarah Jenkins:', sarahCompany.id);
    }
    await prisma.user.update({
      where: { id: sarah.id },
      data: { companyId: sarahCompany.id },
    });
  }

  // 2. Ensure Company for John Doe
  const johnDoe = await prisma.user.findUnique({ where: { email: 'user@example.com' } });
  let johnCompany;
  if (johnDoe) {
    johnCompany = await prisma.company.findUnique({ where: { ownerId: johnDoe.id } });
    if (!johnCompany) {
      johnCompany = await prisma.company.create({
        data: {
          name: 'Doe Enterprises',
          description: 'Project development and logistics',
          ownerId: johnDoe.id,
        },
      });
      console.log('✅ Created company for John Doe:', johnCompany.id);
    }
    await prisma.user.update({
      where: { id: johnDoe.id },
      data: { companyId: johnCompany.id },
    });
  }

  // 3. Ensure Company for Johnny
  const johnny = await prisma.user.findUnique({ where: { email: 'johnny@gmail.com' } });
  let johnnyCompany;
  if (johnny) {
    johnnyCompany = await prisma.company.findUnique({ where: { ownerId: johnny.id } });
    if (!johnnyCompany) {
      johnnyCompany = await prisma.company.create({
        data: {
          name: "Johnny's Business",
          description: 'Industrial maintenance and construction',
          ownerId: johnny.id,
        },
      });
      console.log('✅ Created company for Johnny:', johnnyCompany.id);
    }
    await prisma.user.update({
      where: { id: johnny.id },
      data: { companyId: johnnyCompany.id },
    });
  }

  // 4. Any other BUSINESS_OWNER without a Company
  const otherOwners = await prisma.user.findMany({
    where: { role: 'BUSINESS_OWNER', companyId: null },
  });
  for (const owner of otherOwners) {
    const comp = await prisma.company.create({
      data: {
        name: `${owner.fullName}'s Company`,
        ownerId: owner.id,
      },
    });
    await prisma.user.update({
      where: { id: owner.id },
      data: { companyId: comp.id },
    });
    console.log(`✅ Created company for owner ${owner.email}`);
  }

  // 5. Associate Sarah's Workers (worker@bpms.com, mike@bpms.com, lisa@bpms.com)
  if (sarahCompany && sarah) {
    const sarahWorkersEmails = ['worker@bpms.com', 'mike@bpms.com', 'lisa@bpms.com'];
    for (const email of sarahWorkersEmails) {
      const u = await prisma.user.findUnique({ where: { email } });
      if (u) {
        await prisma.user.update({
          where: { id: u.id },
          data: { companyId: sarahCompany.id, ownerId: sarah.id },
        });
        await prisma.worker.updateMany({
          where: { userId: u.id },
          data: { companyId: sarahCompany.id, ownerId: sarah.id },
        });
        console.log(`✅ Linked worker ${email} to Sarah Jenkins (${sarahCompany.name})`);
      }
    }

    // 6. Associate Sarah's Clients (client@bpms.com, amanda@apex.com)
    const sarahClientsEmails = ['client@bpms.com', 'amanda@apex.com'];
    for (const email of sarahClientsEmails) {
      const u = await prisma.user.findUnique({ where: { email } });
      if (u) {
        await prisma.user.update({
          where: { id: u.id },
          data: { companyId: sarahCompany.id, ownerId: sarah.id },
        });
        console.log(`✅ Linked client ${email} to Sarah Jenkins (${sarahCompany.name})`);
      }
    }

    // 7. Associate Sarah's Projects
    await prisma.project.updateMany({
      where: { createdById: sarah.id },
      data: { companyId: sarahCompany.id },
    });
    console.log("✅ Linked Sarah's projects to Sarah's company");

    // 8. Associate Sarah's Materials and Alerts
    await prisma.material.updateMany({
      where: { companyId: null },
      data: { companyId: sarahCompany.id, createdById: sarah.id },
    });
    await prisma.lowStockAlert.updateMany({
      where: { companyId: null },
      data: { companyId: sarahCompany.id },
    });
    console.log("✅ Linked legacy materials and alerts to Sarah's company");

    // 9. Associate Sarah's Invoices and Expenses
    await prisma.invoice.updateMany({
      where: { createdById: sarah.id },
      data: { companyId: sarahCompany.id },
    });
    await prisma.expense.updateMany({
      where: { createdById: sarah.id },
      data: { companyId: sarahCompany.id },
    });
    console.log("✅ Linked Sarah's invoices & expenses to Sarah's company");
  }

  // 10. Associate Johnny's Worker (chandu@johnny.com)
  if (johnnyCompany && johnny) {
    const chandu = await prisma.user.findUnique({ where: { email: 'chandu@johnny.com' } });
    if (chandu) {
      await prisma.user.update({
        where: { id: chandu.id },
        data: { companyId: johnnyCompany.id, ownerId: johnny.id },
      });
      await prisma.worker.updateMany({
        where: { userId: chandu.id },
        data: { companyId: johnnyCompany.id, ownerId: johnny.id },
      });
      console.log(`✅ Linked worker chandu@johnny.com to Johnny (${johnnyCompany.name})`);
    }
  }

  console.log('🎉 Tenancy migration completed successfully!');
}

migrate()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
