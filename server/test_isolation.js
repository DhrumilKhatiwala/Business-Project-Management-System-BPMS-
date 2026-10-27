require('dotenv').config();
const prisma = require('./src/utils/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function makeToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('🧪 Starting Multi-Tenant Isolation & Authentication Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Check Sarah Jenkins (Business Owner)
    const sarah = await prisma.user.findUnique({
      where: { email: 'owner@bpms.com' },
      include: { ownedCompany: true },
    });
    assert(sarah && sarah.companyId, 'Sarah Jenkins has a valid companyId');
    assert(sarah.ownedCompany && sarah.ownedCompany.name === 'Jenkins Construction & Interiors', 'Sarah Jenkins owns Jenkins Construction');

    // 2. Check Johnny (Business Owner)
    const johnny = await prisma.user.findUnique({
      where: { email: 'johnny@gmail.com' },
      include: { ownedCompany: true },
    });
    assert(johnny && johnny.companyId, 'Johnny has a valid companyId');
    assert(johnny.companyId !== sarah.companyId, 'Johnny and Sarah have completely separate company IDs');

    // 3. Check John Doe (Business Owner)
    const johnDoe = await prisma.user.findUnique({
      where: { email: 'user@example.com' },
      include: { ownedCompany: true },
    });
    assert(johnDoe && johnDoe.companyId, 'John Doe has a valid companyId');
    assert(johnDoe.companyId !== sarah.companyId && johnDoe.companyId !== johnny.companyId, 'John Doe has an independent company ID');

    // 4. Test Projects Scoping
    const sarahProjects = await prisma.project.findMany({ where: { companyId: sarah.companyId } });
    const johnnyProjects = await prisma.project.findMany({ where: { companyId: johnny.companyId } });
    const johnDoeProjects = await prisma.project.findMany({ where: { companyId: johnDoe.companyId } });

    assert(sarahProjects.length === 3, `Sarah has 3 projects (found ${sarahProjects.length})`);
    assert(johnnyProjects.length === 0, `Johnny has 0 projects - isolated empty state (found ${johnnyProjects.length})`);
    assert(johnDoeProjects.length === 0, `John Doe has 0 projects - isolated empty state (found ${johnDoeProjects.length})`);

    // 5. Test Materials Scoping
    const sarahMaterials = await prisma.material.findMany({ where: { companyId: sarah.companyId } });
    const johnnyMaterials = await prisma.material.findMany({ where: { companyId: johnny.companyId } });

    assert(sarahMaterials.length === 5, `Sarah has 5 materials (found ${sarahMaterials.length})`);
    assert(johnnyMaterials.length === 0, `Johnny has 0 materials - isolated empty state (found ${johnnyMaterials.length})`);

    // 6. Test Worker Association
    const workerJohnMiller = await prisma.worker.findFirst({
      where: { user: { email: 'worker@bpms.com' } },
      include: { user: true, owner: true, company: true },
    });
    assert(workerJohnMiller && workerJohnMiller.ownerId === sarah.id, 'John Miller worker is permanently bound to Sarah Jenkins as owner');
    assert(workerJohnMiller && workerJohnMiller.companyId === sarah.companyId, 'John Miller worker is permanently bound to Sarah Jenkins company');

    const workerChandu = await prisma.worker.findFirst({
      where: { user: { email: 'chandu@johnny.com' } },
      include: { user: true, owner: true, company: true },
    });
    assert(workerChandu && workerChandu.ownerId === johnny.id, 'Chandu worker is permanently bound to Johnny as owner');
    assert(workerChandu && workerChandu.companyId === johnny.companyId, 'Chandu worker is permanently bound to Johnny company');
    assert(workerChandu.ownerId !== sarah.id, 'Chandu is NOT bound to Sarah Jenkins');

    // 7. Test Workers Query Scoping for Business Owner
    const sarahWorkers = await prisma.worker.findMany({
      where: { OR: [{ companyId: sarah.companyId }, { ownerId: sarah.id }] },
    });
    const johnnyWorkers = await prisma.worker.findMany({
      where: { OR: [{ companyId: johnny.companyId }, { ownerId: johnny.id }] },
    });

    assert(sarahWorkers.length === 3, `Sarah sees 3 workers (found ${sarahWorkers.length})`);
    assert(johnnyWorkers.length === 1, `Johnny sees only 1 worker - Chandu (found ${johnnyWorkers.length})`);

    // 8. Test Client Association
    const clientRobert = await prisma.user.findUnique({
      where: { email: 'client@bpms.com' },
      include: { assignedOwner: true },
    });
    assert(clientRobert && clientRobert.ownerId === sarah.id, 'Client Robert is bound to Sarah Jenkins');
    assert(clientRobert.companyId === sarah.companyId, 'Client Robert is bound to Sarah company');

    console.log(`\n📊 Tests Finished: ${passed} Passed, ${failed} Failed.`);
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
