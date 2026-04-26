import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const orgs = await prisma.organization.findMany({
  select: { id: true, name: true, _count: { select: { clientTags: true } } },
});
console.log('Orgs and tag counts:');
for (const o of orgs) console.log(`  ${o.id} | ${o.name} | tags=${o._count.clientTags}`);
const tags = await prisma.clientTag.findMany({ select: { orgId: true, name: true, active: true, deletedAt: true } });
console.log(`\nTotal tag rows: ${tags.length}`);
tags.slice(0, 10).forEach((t) => console.log(`  org=${t.orgId} name=${t.name} active=${t.active} deletedAt=${t.deletedAt}`));
await prisma.$disconnect();
