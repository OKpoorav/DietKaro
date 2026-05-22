/**
 * Apply extracted notes to client + related tables.
 *
 * Composes existing services rather than duplicating their logic:
 *   - lab values  → labService.saveLabValues (most-recent report wins for MedicalProfile)
 *   - measurements → prisma.bodyMeasurement.upsert (per-date)
 *   - arrays      → merge-dedupe with current Client.* arrays
 *   - scalars     → only seed if currently empty (non-destructive)
 *
 * Stores the full payload on Client.extractedNotes for replay / Key-Value view.
 */

import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import { labService } from './lab.service';
import { validationEngine } from './validationEngine.service';
import { invalidateClientCache } from '../utils/cache';
import logger from '../utils/logger';
import type { NotesExtraction, ExtractedLabReport } from './ai/notes-extract';

export function buildNotesSummary(extracted: NotesExtraction): string {
    const parts: string[] = [];

    const demo: string[] = [];
    if (extracted.age) demo.push(`Age ${extracted.age}`);
    if (extracted.heightCm) demo.push(`${extracted.heightCm}cm`);
    if (extracted.currentWeightKg) demo.push(`${extracted.currentWeightKg}kg`);
    if (demo.length) parts.push(demo.join(' · '));

    if (extracted.medicalIssues?.length) {
        parts.push(`Issues: ${extracted.medicalIssues.slice(0, 4).join(', ')}`);
    }
    if (extracted.allergies?.length) {
        parts.push(`Allergies: ${extracted.allergies.slice(0, 3).join(', ')}`);
    }
    if (extracted.intolerances?.length) {
        parts.push(`Intolerances: ${extracted.intolerances.slice(0, 3).join(', ')}`);
    }
    if (extracted.bloodReports?.length) {
        parts.push(`${extracted.bloodReports.length} blood report${extracted.bloodReports.length === 1 ? '' : 's'}`);
    }
    if (extracted.bodyMeasurements?.length) {
        parts.push(`${extracted.bodyMeasurements.length} measurement${extracted.bodyMeasurements.length === 1 ? '' : 's'}`);
    }
    if (extracted.referredBy) {
        parts.push(`Ref: ${extracted.referredBy}`);
    }

    return parts.length ? parts.join(' · ') : 'Internal notes recorded.';
}

function mergeUnique(existing: string[] | null | undefined, incoming: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of [...(existing ?? []), ...incoming]) {
        const t = v.trim();
        if (!t) continue;
        const k = t.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(t);
    }
    return out;
}

function parseISODate(s: string | null): Date | null {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

function ageToDateOfBirth(age: number): Date {
    const d = new Date();
    d.setFullYear(d.getFullYear() - age);
    return d;
}

interface ApplyInput {
    clientId: string;
    orgId: string;
    userId: string;
    /** The (possibly user-edited) extracted payload from the verify modal. */
    extracted: NotesExtraction;
    /** The raw notes text — stored alongside so it stays accessible. */
    rawNotes: string;
}

export async function applyExtractedNotes(input: ApplyInput) {
    const { clientId, orgId, userId, extracted, rawNotes } = input;

    const client = await prisma.client.findFirst({
        where: { id: clientId, orgId, isActive: true },
        select: {
            id: true, fullName: true, dateOfBirth: true, heightCm: true, currentWeightKg: true,
            allergies: true, medicalConditions: true, intolerances: true,
            dislikes: true, likedFoods: true,
        },
    });
    if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

    // ── 1. Body measurements: upsert per date (idempotent on [clientId, logDate]) ──
    // Skip entries with no actual values (AI sometimes emits a row with all nulls).
    const measurementsApplied: { date: string; id: string }[] = [];
    let measurementsSkippedNoDate = 0;
    let measurementsSkippedAllNull = 0;
    for (const m of extracted.bodyMeasurements) {
        const date = parseISODate(m.date);
        if (!date) { measurementsSkippedNoDate++; continue; }
        const data = {
            chestCm: m.chestCm,
            waistCm: m.waistCm,
            hipsCm: m.hipsCm,
            thighsCm: m.thighsCm,
            armsCm: m.armsCm,
            stomachCm: m.stomachCm,
            bellyAboveNavelCm: m.bellyAboveNavelCm,
            bellyBelowNavelCm: m.bellyBelowNavelCm,
            calfCm: m.calfCm,
        };
        // Don't insert an empty row.
        const hasAnyValue = Object.values(data).some((v) => v !== null);
        if (!hasAnyValue) { measurementsSkippedAllNull++; continue; }

        const row = await prisma.bodyMeasurement.upsert({
            where: { clientId_logDate: { clientId, logDate: date } },
            create: { clientId, orgId, logDate: date, createdByUserId: userId, ...data },
            update: data,
            select: { id: true, logDate: true },
        });
        measurementsApplied.push({ date: row.logDate.toISOString().slice(0, 10), id: row.id });
    }

    // ── 2. Lab reports: most-recent wins for MedicalProfile (single labValues slot) ──
    // Sort by date desc; pick the first dated entry that has any values.
    const datedReports = extracted.bloodReports
        .map((r) => ({ ...r, _d: parseISODate(r.date) }))
        .filter((r): r is ExtractedLabReport & { _d: Date } => r._d !== null && Object.keys(r.values).length > 0)
        .sort((a, b) => b._d.getTime() - a._d.getTime());

    let labResult: { derivedTags: string[]; alertCount: number } | null = null;
    if (datedReports.length > 0) {
        const latest = datedReports[0];
        const r = await labService.saveLabValues({
            clientId, orgId, userId,
            labValues: latest.values,
            labDate: latest._d.toISOString().slice(0, 10),
        });
        labResult = {
            derivedTags: r.derivedTags,
            alertCount: r.alerts.filter((a) => a.status !== 'normal').length,
        };
    }

    // ── 3. Merge arrays + non-destructive scalar fills on Client ──
    const clientUpdate: Record<string, unknown> = {};

    if (extracted.allergies.length) {
        clientUpdate.allergies = mergeUnique(client.allergies, extracted.allergies);
    }
    if (extracted.intolerances.length) {
        clientUpdate.intolerances = mergeUnique(client.intolerances, extracted.intolerances);
    }
    if (extracted.medicalIssues.length) {
        clientUpdate.medicalConditions = mergeUnique(client.medicalConditions, extracted.medicalIssues);
    }
    if (extracted.dislikes.length) {
        clientUpdate.dislikes = mergeUnique(client.dislikes, extracted.dislikes);
    }
    if (extracted.likedFoods.length) {
        clientUpdate.likedFoods = mergeUnique(client.likedFoods, extracted.likedFoods);
    }
    if (extracted.age !== null && !client.dateOfBirth) {
        clientUpdate.dateOfBirth = ageToDateOfBirth(extracted.age);
    }
    if (extracted.heightCm !== null && !client.heightCm) {
        clientUpdate.heightCm = extracted.heightCm;
    }
    if (extracted.currentWeightKg !== null && !client.currentWeightKg) {
        clientUpdate.currentWeightKg = extracted.currentWeightKg;
    }

    // Always store the full extracted payload + raw notes (for Key-Value view).
    clientUpdate.extractedNotes = {
        extracted,
        rawNotes,
        extractedAt: new Date().toISOString(),
        extractedByUserId: userId,
    };

    await prisma.client.update({ where: { id: clientId }, data: clientUpdate });

    // ── 4. Family history → MedicalProfile.familyHistory (only if empty) ──
    if (extracted.familyHistory.length) {
        const existing = await prisma.medicalProfile.findUnique({
            where: { clientId },
            select: { familyHistory: true },
        });
        if (!existing?.familyHistory) {
            await prisma.medicalProfile.upsert({
                where: { clientId },
                create: { clientId, familyHistory: extracted.familyHistory.join('; '), updatedByUserId: userId },
                update: { familyHistory: extracted.familyHistory.join('; '), updatedByUserId: userId },
            });
        }
    }

    // ── 5. ClientReport for history. Synthetic "internal notes" report — name
    //       `internal-notes-{clientName}-{YYYY-MM-DD}.txt`. Linked ReportSummary
    //       stores the raw text + structured extraction so it survives even if
    //       extractedNotes on Client is later overwritten by another extraction.
    const today = new Date().toISOString().slice(0, 10);
    const safeName = client.fullName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'client';
    const reportFileName = `internal-notes-${safeName}-${today}.txt`;
    const labValuesByDate = datedReports.reduce<Record<string, Record<string, number>>>((acc, r) => {
        acc[r._d.toISOString().slice(0, 10)] = r.values;
        return acc;
    }, {});

    const report = await prisma.clientReport.create({
        data: {
            orgId,
            clientId,
            fileName: reportFileName,
            fileUrl: '', // synthetic: text lives in linked ReportSummary.rawText
            fileType: 'txt',
            mimeType: 'text/plain',
            reportType: 'internal_notes',
            notes: 'Extracted from dietitian internal notes',
            processingStatus: 'done',
            uploadedByUserId: userId,
            uploaderRole: 'dietitian',
            summary: {
                create: {
                    rawText: rawNotes,
                    summaryText: buildNotesSummary(extracted),
                    extractedData: { ...extracted, labValuesByDate } as unknown as object,
                    modelVersion: 'gemini-2.5-flash:notes-extract',
                    promptVersion: 1,
                },
            },
        },
        select: { id: true, fileName: true },
    });

    // Validation engine cache must be busted since tags/restrictions may have changed.
    validationEngine.invalidateClientCache(clientId);
    // Bust the per-client response cache so subsequent /clients/:id returns the new data.
    invalidateClientCache(clientId);

    logger.info('Notes extraction applied', {
        clientId,
        bodyMeasurementsExtracted: extracted.bodyMeasurements.length,
        measurementsApplied: measurementsApplied.length,
        measurementsSkippedNoDate,
        measurementsSkippedAllNull,
        bloodReportsExtracted: extracted.bloodReports.length,
        labReportApplied: labResult ? 1 : 0,
        derivedTags: labResult?.derivedTags ?? [],
        clientReportCreated: report.id,
    });

    return {
        measurementsApplied,
        labReportApplied: labResult,
        clientReportId: report.id,
        clientReportName: report.fileName,
        clientFieldsUpdated: Object.keys(clientUpdate).filter((k) => k !== 'extractedNotes'),
    };
}
