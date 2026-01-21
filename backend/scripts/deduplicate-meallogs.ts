/**
 * Script to find and deduplicate MealLog entries
 * Run this BEFORE applying the unique constraint
 * 
 * Usage: npx ts-node scripts/deduplicate-meallogs.ts
 */

import prisma from '../src/utils/prisma';

async function findDuplicates() {
    console.log('🔍 Finding duplicate meal logs...\n');

    // Find duplicates using raw query
    const duplicates = await prisma.$queryRaw<Array<{
        clientId: string;
        mealId: string;
        scheduledDate: Date;
        count: bigint;
    }>>`
        SELECT "clientId", "mealId", "scheduledDate", COUNT(*) as count
        FROM "MealLog"
        GROUP BY "clientId", "mealId", "scheduledDate"
        HAVING COUNT(*) > 1
    `;

    console.log(`Found ${duplicates.length} duplicate groups\n`);

    for (const dup of duplicates) {
        console.log(`Duplicate: clientId=${dup.clientId.slice(0, 8)}..., mealId=${dup.mealId.slice(0, 8)}..., date=${dup.scheduledDate}, count=${dup.count}`);
    }

    return duplicates;
}

async function deduplicateMealLogs(dryRun = true) {
    console.log(`\n🧹 ${dryRun ? '[DRY RUN] ' : ''}Deduplicating meal logs...\n`);

    const duplicates = await findDuplicates();
    let deletedCount = 0;

    for (const dup of duplicates) {
        // Get all logs for this duplicate group
        const logs = await prisma.mealLog.findMany({
            where: {
                clientId: dup.clientId,
                mealId: dup.mealId,
                scheduledDate: dup.scheduledDate
            },
            orderBy: [
                { loggedAt: 'desc' },  // Prefer logged over pending
                { updatedAt: 'desc' }, // Prefer most recently updated
                { createdAt: 'desc' }  // Fallback to most recently created
            ]
        });

        // Keep the first (best) one, delete the rest
        const [keep, ...toDelete] = logs;

        console.log(`  Keeping log ${keep.id} (status: ${keep.status}, loggedAt: ${keep.loggedAt})`);

        for (const log of toDelete) {
            console.log(`  ${dryRun ? 'Would delete' : 'Deleting'} log ${log.id} (status: ${log.status})`);

            if (!dryRun) {
                await prisma.mealLog.delete({ where: { id: log.id } });
                deletedCount++;
            }
        }
    }

    console.log(`\n${dryRun ? 'Would delete' : 'Deleted'} ${dryRun ? duplicates.reduce((acc, d) => acc + Number(d.count) - 1, 0) : deletedCount} duplicate logs`);
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--apply');

    if (dryRun) {
        console.log('⚠️  Running in DRY RUN mode. Use --apply to actually delete duplicates.\n');
    }

    try {
        await deduplicateMealLogs(dryRun);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
