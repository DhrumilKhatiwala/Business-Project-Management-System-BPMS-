const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.lowStockAlert.deleteMany();
  await prisma.stockUpdate.deleteMany();
  await prisma.material.deleteMany();
  await prisma.task.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.projectAssignment.deleteMany();
  await prisma.project.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.user.deleteMany();

  // 1. MODULE 1: Accounts & Access
  const adminPassword = await bcrypt.hash('admin123', 10);
  const workerPassword = await bcrypt.hash('worker123', 10);
  const clientPassword = await bcrypt.hash('client123', 10);

  // Business Owner
  const owner = await prisma.user.create({
    data: {
      fullName: 'Sarah Jenkins (Business Owner)',
      email: 'admin@bpms.com',
      password: adminPassword,
      role: 'BUSINESS_OWNER',
      phone: '+1 (555) 019-2831',
      status: 'ACTIVE',
    },
  });

  // Workers
  const worker1User = await prisma.user.create({
    data: {
      fullName: 'John Miller',
      email: 'worker@bpms.com',
      password: workerPassword,
      role: 'WORKER',
      phone: '+1 (555) 019-2832',
      status: 'ACTIVE',
    },
  });

  const worker1 = await prisma.worker.create({
    data: {
      userId: worker1User.id,
      position: 'Senior Site Engineer',
      skills: JSON.stringify(['Construction', 'Project Planning', 'Structural Engineering', 'AutoCAD']),
      status: 'ACTIVE',
    },
  });

  const worker2User = await prisma.user.create({
    data: {
      fullName: 'Michael Chen',
      email: 'mike@bpms.com',
      password: workerPassword,
      role: 'WORKER',
      phone: '+1 (555) 019-2833',
      status: 'ACTIVE',
    },
  });

  const worker2 = await prisma.worker.create({
    data: {
      userId: worker2User.id,
      position: 'Master Electrician',
      skills: JSON.stringify(['Electrical Wiring', 'Safety Auditing', 'HVAC Integration']),
      status: 'ACTIVE',
    },
  });

  const worker3User = await prisma.user.create({
    data: {
      fullName: 'Lisa Patel',
      email: 'lisa@bpms.com',
      password: workerPassword,
      role: 'WORKER',
      phone: '+1 (555) 019-2834',
      status: 'ACTIVE',
    },
  });

  const worker3 = await prisma.worker.create({
    data: {
      userId: worker3User.id,
      position: 'Civil Contractor',
      skills: JSON.stringify(['Carpentry', 'Plumbing', 'Masonry', 'Quality Control']),
      status: 'ACTIVE',
    },
  });

  // Clients
  const client1 = await prisma.user.create({
    data: {
      fullName: 'Robert Sterling (Metro Corp)',
      email: 'client@bpms.com',
      password: clientPassword,
      role: 'CLIENT',
      phone: '+1 (555) 019-2835',
      status: 'ACTIVE',
    },
  });

  const client2 = await prisma.user.create({
    data: {
      fullName: 'Amanda Vance (Apex Real Estate)',
      email: 'amanda@apex.com',
      password: clientPassword,
      role: 'CLIENT',
      phone: '+1 (555) 019-2836',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Users & Workforce seeded');

  // 2. MODULE 2: Workforce & Projects
  const project1 = await prisma.project.create({
    data: {
      name: 'Commercial High-Rise HQ',
      description: '12-floor corporate headquarters interior fitting and electrical layout installation.',
      status: 'IN_PROGRESS',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-12-15'),
      progress: 60,
      createdById: owner.id,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: 'Greenfield Residential Villa',
      description: 'Modern 4-bedroom eco-friendly residential construction with solar grid integration.',
      status: 'IN_PROGRESS',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-02-28'),
      progress: 25,
      createdById: owner.id,
    },
  });

  const project3 = await prisma.project.create({
    data: {
      name: 'Logistics Warehouse Bay 4',
      description: 'Automated racking foundations and heavy concrete floor leveling.',
      status: 'NOT_STARTED',
      startDate: new Date('2026-10-15'),
      endDate: new Date('2027-04-30'),
      progress: 0,
      createdById: owner.id,
    },
  });

  // Project Assignments
  await prisma.projectAssignment.createMany({
    data: [
      { projectId: project1.id, workerId: worker1.id },
      { projectId: project1.id, workerId: worker2.id },
      { projectId: project2.id, workerId: worker1.id },
      { projectId: project2.id, workerId: worker3.id },
      { projectId: project3.id, workerId: worker3.id },
    ],
  });

  // Milestones
  await prisma.milestone.createMany({
    data: [
      {
        projectId: project1.id,
        title: 'Architectural Blueprint Sign-off',
        description: 'Client approval and municipality permit clearance.',
        dueDate: new Date('2026-08-20'),
        status: 'COMPLETED',
      },
      {
        projectId: project1.id,
        title: 'Structural Steel and Concrete Core',
        description: 'Floors 1-6 core columns completion.',
        dueDate: new Date('2026-10-01'),
        status: 'IN_PROGRESS',
      },
      {
        projectId: project1.id,
        title: 'Full Electrical & Mechanical Rough-in',
        description: 'HVAC ducts, fire lines, and electrical conduits.',
        dueDate: new Date('2026-11-15'),
        status: 'PENDING',
      },
      {
        projectId: project2.id,
        title: 'Foundation & Earthwork',
        description: 'Excavation and foundation curing.',
        dueDate: new Date('2026-09-30'),
        status: 'IN_PROGRESS',
      },
      {
        projectId: project2.id,
        title: 'Framing & Roofing',
        description: 'Timber framing and water-tight roof installation.',
        dueDate: new Date('2026-11-30'),
        status: 'PENDING',
      },
    ],
  });

  // Tasks
  await prisma.task.createMany({
    data: [
      {
        projectId: project1.id,
        assignedToId: worker1.id,
        title: 'Review CAD structural load calculations',
        description: 'Verify beam deflection standards for floors 4 through 8.',
        priority: 'HIGH',
        status: 'COMPLETED',
        dueDate: new Date('2026-08-15'),
      },
      {
        projectId: project1.id,
        assignedToId: worker2.id,
        title: 'Install 480V main distribution panel',
        description: 'Connect step-down transformers to main building riser.',
        priority: 'URGENT',
        status: 'IN_PROGRESS',
        dueDate: new Date('2026-09-28'),
      },
      {
        projectId: project1.id,
        assignedToId: worker1.id,
        title: 'Site safety inspection for crane operations',
        description: 'Weekly OSHA compliance check on high-altitude rigging.',
        priority: 'HIGH',
        status: 'PENDING',
        dueDate: new Date('2026-09-30'),
      },
      {
        projectId: project2.id,
        assignedToId: worker3.id,
        title: 'Pour grade beam concrete foundations',
        description: 'Apply high-durability 4000 PSI concrete mix.',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        dueDate: new Date('2026-09-29'),
      },
      {
        projectId: project2.id,
        assignedToId: worker1.id,
        title: 'Soil compaction verification test',
        description: 'Collect core samples from perimeter retaining walls.',
        priority: 'MEDIUM',
        status: 'PENDING',
        dueDate: new Date('2026-10-05'),
      },
      {
        projectId: project3.id,
        assignedToId: worker3.id,
        title: 'Site perimeter fencing & security survey',
        description: 'Install temporary barriers and staging access gates.',
        priority: 'LOW',
        status: 'PENDING',
        dueDate: new Date('2026-10-20'),
      },
    ],
  });

  console.log('✅ Projects, Assignments, Milestones & Tasks seeded');

  // 3. MODULE 3: Inventory & Materials
  const m1 = await prisma.material.create({
    data: {
      name: 'Portland Cement (50kg Bag)',
      description: 'Type I/II high-grade general-purpose Portland cement.',
      category: 'Masonry & Concrete',
      unit: 'bags',
      quantity: 180,
      minStockLevel: 50,
      costPerUnit: 14.50,
      supplier: 'National Concrete Supplies Ltd.',
      status: 'ACTIVE',
    },
  });

  const m2 = await prisma.material.create({
    data: {
      name: 'Deformed Steel Rebar #4 (1/2")',
      description: 'Grade 60 structural reinforcement steel bars (20ft length).',
      category: 'Structural Steel',
      unit: 'pcs',
      quantity: 24,
      minStockLevel: 40, // Low stock!
      costPerUnit: 19.80,
      supplier: 'Apex Steel Mills',
      status: 'ACTIVE',
    },
  });

  const m3 = await prisma.material.create({
    data: {
      name: 'THHN Copper Wire (12 AWG, 500ft)',
      description: 'Solid copper insulated electrical wire spool for conduits.',
      category: 'Electrical',
      unit: 'spools',
      quantity: 5,
      minStockLevel: 10, // Low stock!
      costPerUnit: 89.00,
      supplier: 'VoltMax Electric Supplies',
      status: 'ACTIVE',
    },
  });

  const m4 = await prisma.material.create({
    data: {
      name: 'Schedule 40 PVC Pipe (3" x 10ft)',
      description: 'Rigid PVC drainage and plumbing conduit pipes.',
      category: 'Plumbing',
      unit: 'pcs',
      quantity: 0, // Out of stock!
      minStockLevel: 20,
      costPerUnit: 22.40,
      supplier: 'ProFlow Plumbing Wholesale',
      status: 'ACTIVE',
    },
  });

  const m5 = await prisma.material.create({
    data: {
      name: 'Exterior Acrylic Latex Paint (5 Gal)',
      description: 'Weather-resistant matte white exterior coating.',
      category: 'Finishing & Paints',
      unit: 'buckets',
      quantity: 65,
      minStockLevel: 15,
      costPerUnit: 110.00,
      supplier: 'ColorCraft Coatings',
      status: 'ACTIVE',
    },
  });

  const m6 = await prisma.material.create({
    data: {
      name: 'Treated Framing Lumber (2x4 x 8ft)',
      description: 'Kiln-dried Douglas fir structural building studs.',
      category: 'Lumber & Timber',
      unit: 'pcs',
      quantity: 320,
      minStockLevel: 100,
      costPerUnit: 7.25,
      supplier: 'Northwoods Timber Co.',
      status: 'ACTIVE',
    },
  });

  // Stock Updates & Low Stock Alerts
  await prisma.stockUpdate.createMany({
    data: [
      {
        materialId: m1.id,
        type: 'ADD',
        quantity: 180,
        previousQty: 0,
        newQty: 180,
        note: 'Initial inventory stocking from National Concrete',
        createdById: owner.id,
      },
      {
        materialId: m2.id,
        type: 'ADD',
        quantity: 50,
        previousQty: 0,
        newQty: 50,
        note: 'Monthly delivery',
        createdById: owner.id,
      },
      {
        materialId: m2.id,
        type: 'DEDUCT',
        quantity: 26,
        previousQty: 50,
        newQty: 24,
        note: 'Dispatched to Commercial HQ Project for column foundation',
        createdById: owner.id,
      },
      {
        materialId: m3.id,
        type: 'DEDUCT',
        quantity: 15,
        previousQty: 20,
        newQty: 5,
        note: 'Used for panel wire harness installation',
        createdById: owner.id,
      },
    ],
  });

  // Low Stock Alerts for m2, m3, m4
  await prisma.lowStockAlert.createMany({
    data: [
      {
        materialId: m2.id,
        currentQuantity: 24,
        minStockLevel: 40,
        status: 'ACTIVE',
      },
      {
        materialId: m3.id,
        currentQuantity: 5,
        minStockLevel: 10,
        status: 'ACTIVE',
      },
      {
        materialId: m4.id,
        currentQuantity: 0,
        minStockLevel: 20,
        status: 'ACTIVE',
      },
    ],
  });

  console.log('✅ Inventory, Stock Updates & Low Stock Alerts seeded');

  console.log('\n🎉 Database successfully seeded with real production test data!');
  console.log('Credentials:');
  console.log('  👑 Business Owner : admin@bpms.com  / admin123');
  console.log('  👷 Worker         : worker@bpms.com / worker123');
  console.log('  🤝 Client         : client@bpms.com / client123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
