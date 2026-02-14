import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { generateDietPlanPDF, generateMealPlanPrintHtml } from '../utils/pdfGenerator';
import { sendEmail, generateDietPlanEmailHtml } from '../utils/emailService';

/**
 * Generate and download PDF for a diet plan
 */
export const downloadDietPlanPdf = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { id } = req.params;

    const plan = await prisma.dietPlan.findFirst({
        where: { id, orgId: req.user.organizationId, isActive: true },
        include: {
            client: {
                select: { fullName: true, currentWeightKg: true, targetWeightKg: true }
            },
            meals: {
                orderBy: [{ dayOfWeek: 'asc' }, { sequenceNumber: 'asc' }],
                include: {
                    foodItems: {
                        orderBy: [{ optionGroup: 'asc' }, { sortOrder: 'asc' }],
                        include: { foodItem: true }
                    }
                }
            }
        }
    });

    if (!plan) throw AppError.notFound('Diet plan not found');

    // Generate PDF
    const doc = generateDietPlanPDF(plan);

    // Set response headers for PDF download
    const filename = `diet-plan-${plan.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);
    doc.end();

    logger.info('Diet plan PDF generated', { planId: id, userId: req.user.id });
});

/**
 * Get print-friendly HTML view of diet plan
 */
export const getDietPlanPrintView = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { id } = req.params;

    const plan = await prisma.dietPlan.findFirst({
        where: { id, orgId: req.user.organizationId, isActive: true },
        include: {
            client: {
                select: { fullName: true, currentWeightKg: true, targetWeightKg: true }
            },
            meals: {
                orderBy: [{ dayOfWeek: 'asc' }, { sequenceNumber: 'asc' }],
                include: {
                    foodItems: {
                        orderBy: [{ optionGroup: 'asc' }, { sortOrder: 'asc' }],
                        include: { foodItem: true }
                    }
                }
            }
        }
    });

    if (!plan) throw AppError.notFound('Diet plan not found');

    const html = generateMealPlanPrintHtml(plan);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);

    logger.info('Diet plan print view generated', { planId: id, userId: req.user.id });
});

/**
 * Send diet plan via email to client
 */
export const emailDietPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { id } = req.params;
    const { recipientEmail, customMessage } = req.body;

    const plan = await prisma.dietPlan.findFirst({
        where: { id, orgId: req.user.organizationId, isActive: true },
        include: {
            client: {
                select: {
                    fullName: true,
                    email: true,
                    currentWeightKg: true,
                    targetWeightKg: true
                }
            },
            creator: {
                select: { fullName: true }
            },
            meals: {
                orderBy: [{ dayOfWeek: 'asc' }, { sequenceNumber: 'asc' }],
                include: {
                    foodItems: {
                        orderBy: [{ optionGroup: 'asc' }, { sortOrder: 'asc' }],
                        include: { foodItem: true }
                    }
                }
            }
        }
    });

    if (!plan) throw AppError.notFound('Diet plan not found');

    // Use provided email or client's email
    const targetEmail = recipientEmail || plan.client?.email;
    if (!targetEmail) {
        throw AppError.badRequest('No email address provided or client has no email');
    }

    // Generate PDF as buffer
    const doc = generateDietPlanPDF(plan);
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve());
        doc.on('error', reject);
        doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);

    // Generate email HTML
    const html = generateDietPlanEmailHtml(
        plan.name,
        plan.client?.fullName || 'Client',
        plan.creator?.fullName || 'Your Dietitian'
    );

    // Send email with PDF attachment
    const sent = await sendEmail({
        to: targetEmail,
        subject: `Your Diet Plan: ${plan.name}`,
        html: customMessage
            ? `<p>${customMessage}</p>${html}`
            : html,
        attachments: [
            {
                filename: `${plan.name.replace(/[^a-z0-9]/gi, '-')}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }
        ]
    });

    if (!sent) {
        throw AppError.internal('Failed to send email');
    }

    logger.info('Diet plan emailed', { planId: id, to: targetEmail, userId: req.user.id });

    res.status(200).json({
        success: true,
        data: {
            sent: true,
            recipient: targetEmail
        }
    });
});

/**
 * Generate shareable WhatsApp link for diet plan
 */
export const getDietPlanShareLink = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { id } = req.params;

    const plan = await prisma.dietPlan.findFirst({
        where: { id, orgId: req.user.organizationId, isActive: true },
        include: {
            client: { select: { fullName: true, phone: true } }
        }
    });

    if (!plan) throw AppError.notFound('Diet plan not found');

    // Generate summary message for WhatsApp
    const message = `🥗 *${plan.name}*

Hi ${plan.client?.fullName || 'there'}!

Your personalized diet plan is ready. 

📊 Daily Targets:
${plan.targetCalories ? `• Calories: ${plan.targetCalories} kcal` : ''}
${plan.targetProteinG ? `• Protein: ${plan.targetProteinG}g` : ''}
${plan.targetCarbsG ? `• Carbs: ${plan.targetCarbsG}g` : ''}
${plan.targetFatsG ? `• Fats: ${plan.targetFatsG}g` : ''}

📱 Open the DietKaro app to view your complete meal plan!

Best regards,
Your Dietitian at DietKaro`;

    const whatsappLink = `https://wa.me/${plan.client?.phone?.replace(/[^0-9]/g, '') || ''}?text=${encodeURIComponent(message)}`;

    res.status(200).json({
        success: true,
        data: {
            message,
            whatsappLink,
            clientPhone: plan.client?.phone
        }
    });
});
