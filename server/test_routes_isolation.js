require('dotenv').config();
const app = require('./src/index');
const prisma = require('./src/utils/prisma');

async function runRouteTests() {
  console.log('🧪 Starting API Routes Multi-Tenancy & Authorization Integration Tests...\n');

  // Start app on ephemeral port
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

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
    // 1. Worker public registration rejection
    const workerRegRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Unauthorized Worker',
        email: 'unauth_worker@test.com',
        password: 'password123',
        role: 'WORKER',
      }),
    });
    assert(workerRegRes.status === 403, 'Public worker registration rejected with 403 Forbidden');

    // 2. Admin public registration rejection
    const adminRegRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Unauthorized Admin',
        email: 'unauth_admin@test.com',
        password: 'password123',
        role: 'ADMIN',
      }),
    });
    assert(adminRegRes.status === 403, 'Public admin registration rejected with 403 Forbidden');

    // 3. Register a new Business Owner: Bob Builder
    const bobEmail = `bob_${Date.now()}@builder.com`;
    const ownerRegRes = await fetch(`${baseUrl}/auth/register/owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Bob Builder',
        email: bobEmail,
        password: 'password123',
        companyName: 'Bob Construction Co',
        phone: '+1 555-999-0001',
      }),
    });
    const ownerRegData = await ownerRegRes.json();
    assert(ownerRegRes.status === 201, 'Business Owner registered successfully (201)');
    assert(ownerRegData.token && ownerRegData.user?.companyId, 'Bob received JWT token and companyId');

    const bobToken = ownerRegData.token;
    const bobCompanyId = ownerRegData.user.companyId;

    // 4. Check Bob's Dashboard - MUST be completely empty, NOT showing Sarah's data!
    const bobOverviewRes = await fetch(`${baseUrl}/dashboard/overview`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const bobOverview = await bobOverviewRes.json();
    assert(bobOverview.stats.totalProjects === 0, `Bob starts with 0 projects (got ${bobOverview.stats.totalProjects})`);
    assert(bobOverview.stats.totalUsers === 0, `Bob starts with 0 users (got ${bobOverview.stats.totalUsers})`);
    assert(bobOverview.stats.totalWorkers === 0, `Bob starts with 0 workers (got ${bobOverview.stats.totalWorkers})`);
    assert(bobOverview.stats.activeAlerts === 0, `Bob starts with 0 alerts (got ${bobOverview.stats.activeAlerts})`);

    const bobProjectsRes = await fetch(`${baseUrl}/projects`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const bobProjects = await bobProjectsRes.json();
    assert(bobProjects.length === 0, `Bob projects list is empty [] (got ${bobProjects.length})`);

    const bobMaterialsRes = await fetch(`${baseUrl}/materials`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const bobMaterials = await bobMaterialsRes.json();
    assert(bobMaterials.length === 0, `Bob materials inventory is empty [] (got ${bobMaterials.length})`);

    // 5. Test Cross-Tenant Tampering: Bob tries to access Sarah's project
    const sarahProject = await prisma.project.findFirst({
      where: { name: 'Commercial High-Rise HQ' },
    });
    if (sarahProject) {
      const getSarahProjRes = await fetch(`${baseUrl}/projects/${sarahProject.id}`, {
        headers: { Authorization: `Bearer ${bobToken}` },
      });
      assert(getSarahProjRes.status === 403, `Bob cannot access Sarah's project ID (returned ${getSarahProjRes.status} 403 Forbidden)`);

      const deleteSarahProjRes = await fetch(`${baseUrl}/projects/${sarahProject.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${bobToken}` },
      });
      assert(deleteSarahProjRes.status === 403, `Bob cannot delete Sarah's project (returned ${deleteSarahProjRes.status} 403 Forbidden)`);
    }

    // 6. Test Cross-Tenant Tampering: Bob tries to access Sarah's worker
    const sarahWorker = await prisma.worker.findFirst({
      where: { user: { email: 'worker@bpms.com' } },
    });
    if (sarahWorker) {
      const getSarahWorkerRes = await fetch(`${baseUrl}/workers/${sarahWorker.id}`, {
        headers: { Authorization: `Bearer ${bobToken}` },
      });
      assert(getSarahWorkerRes.status === 403, `Bob cannot access Sarah's worker ID (returned ${getSarahWorkerRes.status} 403 Forbidden)`);
    }

    // 7. Bob creates a worker: Charlie
    const charlieEmail = `charlie_${Date.now()}@bob.com`;
    const createWorkerRes = await fetch(`${baseUrl}/workers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`,
      },
      body: JSON.stringify({
        fullName: 'Charlie Craft',
        email: charlieEmail,
        password: 'workerpassword123',
        position: 'Junior Carpenter',
        skills: ['Woodwork', 'Framing'],
      }),
    });
    const charlieData = await createWorkerRes.json();
    assert(createWorkerRes.status === 201, 'Bob successfully created worker Charlie');
    assert(charlieData.companyId === bobCompanyId, "Charlie's profile has Bob's companyId");
    assert(charlieData.ownerId === ownerRegData.user.id, "Charlie's profile has Bob's user ID as ownerId");

    // 8. Charlie logs in
    const charlieLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: charlieEmail,
        password: 'workerpassword123',
      }),
    });
    const charlieAuth = await charlieLoginRes.json();
    assert(charlieLoginRes.status === 200, 'Charlie worker logged in successfully');
    const charlieToken = charlieAuth.token;

    // 9. Charlie checks My Business Owner (/api/users)
    // MUST return ONLY Bob Builder!
    const charlieUsersRes = await fetch(`${baseUrl}/users`, {
      headers: { Authorization: `Bearer ${charlieToken}` },
    });
    const charlieUsers = await charlieUsersRes.json();
    assert(charlieUsers.users && charlieUsers.users.length === 1, `Charlie sees exactly 1 Business Owner (got ${charlieUsers.users.length})`);
    assert(charlieUsers.users[0].email === bobEmail, `Charlie sees ONLY his assigned owner Bob (${charlieUsers.users[0].email})`);
    assert(charlieUsers.users[0].email !== 'owner@bpms.com', 'Charlie does NOT see Sarah Jenkins or any other business owner');

    // 10. Charlie checks dashboard overview
    const charlieOverviewRes = await fetch(`${baseUrl}/dashboard/overview`, {
      headers: { Authorization: `Bearer ${charlieToken}` },
    });
    const charlieOverview = await charlieOverviewRes.json();
    assert(charlieOverview.assignedOwner && charlieOverview.assignedOwner.email === bobEmail, 'Charlie overview displays his assigned owner Bob Builder details');

    // 11. Register a new Client: Wendy
    const wendyEmail = `wendy_${Date.now()}@client.com`;
    const clientRegRes = await fetch(`${baseUrl}/auth/register/client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Wendy Client',
        email: wendyEmail,
        password: 'clientpassword123',
        companyId: bobCompanyId,
      }),
    });
    const wendyData = await clientRegRes.json();
    assert(clientRegRes.status === 201, 'Wendy client registered successfully');
    const wendyToken = wendyData.token;

    // 12. Wendy checks Client Portal
    const wendyPortalRes = await fetch(`${baseUrl}/client-portal/overview`, {
      headers: { Authorization: `Bearer ${wendyToken}` },
    });
    const wendyPortal = await wendyPortalRes.json();
    assert(wendyPortal.stats.totalProjects === 0, `Wendy starts with 0 contracted projects (got ${wendyPortal.stats.totalProjects})`);
    assert(wendyPortal.projects.length === 0, `Wendy projects array is empty [] (no leak of other companies!)`);

    // Clean up test data created in this test
    await prisma.user.deleteMany({ where: { ownerId: ownerRegData.user.id } });
    await prisma.worker.deleteMany({ where: { ownerId: ownerRegData.user.id } });
    await prisma.user.update({ where: { id: ownerRegData.user.id }, data: { companyId: null } });
    await prisma.company.deleteMany({ where: { id: bobCompanyId } });
    await prisma.user.delete({ where: { id: ownerRegData.user.id } });
    console.log('🧹 Cleaned up temporary test users and company.');

    console.log(`\n🎉 Route Integration Tests Finished: ${passed} Passed, ${failed} Failed.`);
  } catch (err) {
    console.error('Route test error:', err);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runRouteTests();
