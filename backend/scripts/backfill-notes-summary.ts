/**
 * Backfill internal_notes summaryText using the new buildNotesSummary().
 * Existing records were stored with the old `extracted.otherNotes[0]` summary
 * (random first note). This regenerates summaryText from the already-stored
 * extractedData JSON — no AI re-call needed.
 *
 * Run: npx tsx scripts/backfill-notes-summary.ts
 */
import prisma from '../src/utils/prisma';
import { buildNotesSummary } from '../src/services/clientNotesApply.service';
import type { NotesExtraction } from '../src/services/ai/notes-extract';

async function main() {
    const reports = await prisma.clientReport.findMany({
        where: { reportType: 'internal_notes' },
        select: { id: true, fileName: true, summary: { select: { id: true, extractedData: true, summaryText: true } } },
    });

    console.log(`Found ${reports.length} internal_notes reports.`);

    let updated = 0;
    let skipped = 0;
    for (const r of reports) {
        if (!r.summary || !r.summary.extractedData) {
            skipped++;
            continue;
        }
        const extracted = r.summary.extractedData as unknown as NotesExtraction;
        const next = buildNotesSummary(extracted);
        if (next === r.summary.summaryText) {
            skipped++;
            continue;
        }
        await prisma.reportSummary.update({
            where: { id: r.summary.id },
            data: { summaryText: next },
        });
        updated++;
        console.log(`  ${r.fileName}: "${r.summary.summaryText}" → "${next}"`);
    }

    console.log(`\nUpdated: ${updated} · Skipped: ${skipped}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
