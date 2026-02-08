/**
 * Lab Values Service
 * Handles saving lab results, auto-deriving risk tags, syncing to Client
 */

import prisma from '../utils/prisma';
import { LAB_REFERENCE_RANGES, VALID_LAB_KEYS } from '../utils/lab-reference-ranges';
import { validationEngine } from './validationEngine.service';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';
import type { LabAlert } from '../types/medical.types';

interface SaveLabValuesInput {
    clientId: string;
    orgId: string;
    userId: string;
    labValues: Record<string, number>;
    labDate: string;
}

class LabService {
    /**
     * Save lab values, auto-derive risk tags, sync to Client table
     */
    async saveLabValues(input: SaveLabValuesInput) {
        const { clientId, orgId, userId, labValues, labDate } = input;

        // Verify client belongs to org
        const client = await prisma.client.findFirst({
            where: { id: clientId, orgId, isActive: true },
        });
        if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

        // Validate lab value keys
        const cleanedValues: Record<string, number> = {};
        for (const [key, value] of Object.entries(labValues)) {
            if (!VALID_LAB_KEYS.includes(key)) continue;
            if (typeof value !== 'number' || isNaN(value) || value < 0) continue;
            cleanedValues[key] = value;
        }

        if (Object.keys(cleanedValues).length === 0) {
            throw AppError.badRequest('No valid lab values provided');
        }

        // Derive risk tags
        const { derivedTags, alerts } = this.deriveRiskFlags(cleanedValues);

        // Upsert MedicalProfile with lab data
        const medicalProfile = await prisma.medicalProfile.upsert({
            where: { clientId },
            create: {
                clientId,
                labValues: cleanedValues,
                labDate: new Date(labDate),
                labDerivedTags: derivedTags,
                updatedByUserId: userId,
            },
            update: {
                labValues: cleanedValues,
                labDate: new Date(labDate),
                labDerivedTags: derivedTags,
                updatedByUserId: userId,
            },
        });

        // Sync derived tags to Client table for validation engine
        await prisma.client.update({
            where: { id: clientId },
            data: { labDerivedTags: derivedTags },
        });

        // Invalidate validation cache so next food validation uses new tags
        validationEngine.invalidateClientCache(clientId);

        logger.info('Lab values saved', {
            clientId,
            derivedTags,
            alertCount: alerts.filter(a => a.status !== 'normal').length,
        });

        return { medicalProfile, alerts, derivedTags };
    }

    /**
     * Get lab values with computed alerts for a client
     */
    async getLabValues(clientId: string, orgId: string) {
        const client = await prisma.client.findFirst({
            where: { id: clientId, orgId, isActive: true },
            select: { id: true },
        });
        if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

        const profile = await prisma.medicalProfile.findUnique({
            where: { clientId },
            select: {
                labValues: true,
                labDate: true,
                labDerivedTags: true,
            },
        });

        if (!profile?.labValues) {
            return { labValues: null, labDate: null, alerts: [], derivedTags: [] };
        }

        const labValues = profile.labValues as Record<string, number>;
        const { alerts, derivedTags } = this.deriveRiskFlags(labValues);

        return {
            labValues,
            labDate: profile.labDate,
            alerts,
            derivedTags,
        };
    }

    /**
     * Pure function: derive risk tags and alerts from raw lab values
     */
    deriveRiskFlags(labValues: Record<string, number>): {
        derivedTags: string[];
        alerts: LabAlert[];
    } {
        const derivedTags = new Set<string>();
        const alerts: LabAlert[] = [];

        for (const [key, value] of Object.entries(labValues)) {
            if (value === null || value === undefined) continue;

            const range = LAB_REFERENCE_RANGES[key];
            if (!range) continue;

            // Determine status
            let status: LabAlert['status'] = 'normal';
            let derivedTag: string | undefined;

            // Check critical ranges first
            if (range.criticalHigh && value >= range.criticalHigh[0]) {
                status = 'critical';
            } else if (range.criticalLow && value <= range.criticalLow[1]) {
                status = 'critical';
            } else if (range.warningHigh && value >= range.warningHigh[0]) {
                status = 'warning';
            } else if (range.warningLow && value <= range.warningLow[1]) {
                status = 'warning';
            } else if (range.optimal && value >= range.optimal[0] && value <= range.optimal[1]) {
                status = 'optimal';
            }

            // Run derivation rules
            for (const rule of range.derivedTags) {
                if (rule.condition(value)) {
                    derivedTags.add(rule.tag);
                    derivedTag = rule.tag;
                }
            }

            const normalRange = `${range.normal[0]}–${range.normal[1]} ${range.unit}`;

            alerts.push({
                name: range.name,
                value,
                unit: range.unit,
                status,
                normalRange,
                derivedTag,
            });
        }

        return {
            derivedTags: Array.from(derivedTags),
            alerts,
        };
    }
}

export const labService = new LabService();
