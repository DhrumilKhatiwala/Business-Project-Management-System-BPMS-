const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding MongoDB database...');

  // Clean existing data (order matters — delete children first)
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.projectMaterial.deleteMany();
  await prisma.lowStockAlert.deleteMany();
  await prisma.stockUpdate.deleteMany();
  await prisma.task.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.projectAssignment.deleteMany();
  await prisma.project.deleteMany();
  await prisma.material.deleteMany();
  await prisma.company.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.user.deleteMany();

  // 1. MODULE 1: Accounts & Access
  const adminPassword = await bcrypt.hash('admin123', 10);
  const ownerPassword = await bcrypt.hash('owner123', 10);
  const workerPassword = await bcrypt.hash('worker123', 10);
  const clientPassword = await bcrypt.hash('client123', 10);

  // System Administrator (Super Admin)
  const systemAdmin = await prisma.user.create({
    data: {
      fullName: 'System Administrator',
      email: 'admin@bpms.com',
      password: adminPassword,
      role: 'ADMIN',
      phone: '+1 (555) 000-0001',
      status: 'ACTIVE',
    },
  });

  // Business Owner
  const owner = await prisma.user.create({
    data: {
      fullName: 'Sarah Jenkins (Business Owner)',
      email: 'owner@bpms.com',
      password: ownerPassword,
      role: 'BUSINESS_OWNER',
      phone: '+1 (555) 019-2831',
      status: 'ACTIVE',
    },
  });

  // Business Owner Company
  const ownerCompany = await prisma.company.create({
    data: {
      name: 'Jenkins Construction & Interiors',
      description: 'Commercial and residential construction management',
      ownerId: owner.id,
    },
  });

  await prisma.user.update({
    where: { id: owner.id },
    data: { companyId: ownerCompany.id },
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
      companyId: ownerCompany.id,
      ownerId: owner.id,
    },
  });

  const worker1 = await prisma.worker.create({
    data: {
      userId: worker1User.id,
      position: 'Senior Site Engineer',
      skills: JSON.stringify(['Construction', 'Project Planning', 'Structural Engineering', 'AutoCAD']),
      status: 'ACTIVE',
      companyId: ownerCompany.id,
      ownerId: owner.id,
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
      companyId: ownerCompany.id,
      ownerId: owner.id,
    },
  });

  const worker2 = await prisma.worker.create({
    data: {
      userId: worker2User.id,
      position: 'Master Electrician',
      skills: JSON.stringify(['Electrical Wiring', 'Safety Auditing', 'HVAC Integration']),
      status: 'ACTIVE',
      companyId: ownerCompany.id,
      ownerId: owner.id,
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
      companyId: ownerCompany.id,
      ownerId: owner.id,
    },
  });

  const worker3 = await prisma.worker.create({
    data: {
      userId: worker3User.id,
      position: 'Civil Contractor',
      skills: JSON.stringify(['Carpentry', 'Plumbing', 'Masonry', 'Quality Control']),
      status: 'ACTIVE',
      companyId: ownerCompany.id,
      ownerId: owner.id,
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
      companyId: ownerCompany.id,
      ownerId: owner.id,
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
      companyId: ownerCompany.id,
      ownerId: owner.id,
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
      companyId: ownerCompany.id,
      clientId: client1.id,
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
      companyId: ownerCompany.id,
      clientId: client1.id,
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
      companyId: ownerCompany.id,
      clientId: client2.id,
    },
  });

  // Project Assignments (individual creates for MongoDB compatibility)
  const assignmentData = [
    { projectId: project1.id, workerId: worker1.id },
    { projectId: project1.id, workerId: worker2.id },
    { projectId: project2.id, workerId: worker1.id },
    { projectId: project2.id, workerId: worker3.id },
    { projectId: project3.id, workerId: worker3.id },
  ];
  for (const data of assignmentData) {
    await prisma.projectAssignment.create({ data });
  }

  // Milestones (individual creates for MongoDB compatibility)
  const milestoneData = [
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
  ];
  for (const data of milestoneData) {
    await prisma.milestone.create({ data });
  }

  // Tasks (individual creates for MongoDB compatibility)
  const taskData = [
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
  ];
  for (const data of taskData) {
    await prisma.task.create({ data });
  }

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
      companyId: ownerCompany.id,
      createdById: owner.id,
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
      companyId: ownerCompany.id,
      createdById: owner.id,
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
      companyId: ownerCompany.id,
      createdById: owner.id,
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
      companyId: ownerCompany.id,
      createdById: owner.id,
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
      companyId: ownerCompany.id,
      createdById: owner.id,
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
      companyId: ownerCompany.id,
      createdById: owner.id,
    },
  });

  // Stock Updates (individual creates for MongoDB compatibility)
  const stockUpdateData = [
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
  ];
  for (const data of stockUpdateData) {
    await prisma.stockUpdate.create({ data });
  }

  // Low Stock Alerts (individual creates for MongoDB compatibility)
  const alertData = [
    {
      materialId: m2.id,
      currentQuantity: 24,
      minStockLevel: 40,
      status: 'ACTIVE',
      companyId: ownerCompany.id,
    },
    {
      materialId: m3.id,
      currentQuantity: 5,
      minStockLevel: 10,
      status: 'ACTIVE',
      companyId: ownerCompany.id,
    },
    {
      materialId: m4.id,
      currentQuantity: 0,
      minStockLevel: 20,
      status: 'ACTIVE',
      companyId: ownerCompany.id,
    },
  ];
  for (const data of alertData) {
    await prisma.lowStockAlert.create({ data });
  }

  console.log('✅ Inventory, Stock Updates & Low Stock Alerts seeded');

  // 4. MODULE 5: Invoices, Payments & Expenses
  const inv1 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-001',
      projectId: project1.id,
      clientId: client1.id,
      amount: 150000,
      paidAmount: 150000,
      dueDate: new Date('2026-09-15'),
      issuedDate: new Date('2026-08-15'),
      status: 'PAID',
      notes: 'Initial milestone payment fully settled.',
      items: JSON.stringify([
        { description: 'Architectural Planning & Engineering Sign-off', quantity: 1, unitPrice: 75000, total: 75000 },
        { description: 'Foundation & Steel Allocation Deposit', quantity: 1, unitPrice: 75000, total: 75000 },
      ]),
      companyId: ownerCompany.id,
      createdById: owner.id,
    },
  });

  await prisma.payment.create({
    data: {
      invoiceId: inv1.id,
      amount: 150000,
      paymentDate: new Date('2026-09-10'),
      paymentMethod: 'BANK_TRANSFER',
      reference: 'TXN-HDFC-991283',
      notes: 'Wire transfer received in full',
      recordedById: owner.id,
    },
  });

  const inv2 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-002',
      projectId: project2.id,
      clientId: client1.id,
      amount: 320000,
      paidAmount: 160000,
      dueDate: new Date('2026-11-01'),
      issuedDate: new Date('2026-09-20'),
      status: 'PARTIALLY_PAID',
      notes: '50% advance received, balance due on completion of civil structure.',
      items: JSON.stringify([
        { description: 'Civil Structure & Brickwork', quantity: 1, unitPrice: 200000, total: 200000 },
        { description: 'Electrical Pre-cabling & Conduit Work', quantity: 1, unitPrice: 120000, total: 120000 },
      ]),
      companyId: ownerCompany.id,
      createdById: owner.id,
    },
  });

  await prisma.payment.create({
    data: {
      invoiceId: inv2.id,
      amount: 160000,
      paymentDate: new Date('2026-09-25'),
      paymentMethod: 'ONLINE',
      reference: 'TXN-RAZORPAY-882194',
      notes: 'First installment paid online',
      recordedById: owner.id,
    },
  });

  const inv3 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-003',
      projectId: project3.id,
      clientId: client2.id,
      amount: 110000,
      paidAmount: 0,
      dueDate: new Date('2026-11-15'),
      issuedDate: new Date('2026-10-01'),
      status: 'PENDING',
      notes: 'Mobilization advance for warehouse bay excavation.',
      items: JSON.stringify([
        { description: 'Site Leveling & Heavy Excavation Advance', quantity: 1, unitPrice: 110000, total: 110000 },
      ]),
      companyId: ownerCompany.id,
      createdById: owner.id,
    },
  });

  // Seed Expenses
  await prisma.expense.create({
    data: {
      title: 'Structural Steel Delivery Batch 1',
      category: 'MATERIALS',
      amount: 45000,
      projectId: project1.id,
      date: new Date('2026-08-22'),
      notes: 'Delivered by Tata Steel',
      companyId: ownerCompany.id,
      createdById: owner.id,
    },
  });

  await prisma.expense.create({
    data: {
      title: 'Excavator & Crane Rental (2 Weeks)',
      category: 'EQUIPMENT',
      amount: 32000,
      projectId: project1.id,
      date: new Date('2026-08-25'),
      notes: 'Heavy machinery rentals',
      companyId: ownerCompany.id,
      createdById: owner.id,
    },
  });

  console.log('✅ Invoices, Payments & Expenses seeded');

  console.log('\n🎉 MongoDB database successfully seeded with real production test data!');
  console.log('Credentials:');
  console.log('  🛡️ System Admin   : admin@bpms.com  / admin123');
  console.log('  👑 Business Owner : owner@bpms.com  / owner123');
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
