import nodemailer from 'nodemailer';
import logger from './logger';

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    attachments?: Array<{
        filename: string;
        content: Buffer | string;
        contentType?: string;
    }>;
}

// Create transporter - uses environment variables for configuration
const createTransporter = () => {
    // For production, use actual SMTP credentials
    if (process.env.SMTP_HOST) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    // For development, use ethereal email (fake SMTP for testing)
    logger.warn('No SMTP configuration found, emails will be logged only');
    return null;
};

export async function sendEmail(options: EmailOptions): Promise<boolean> {
    const transporter = createTransporter();

    const mailOptions = {
        from: process.env.EMAIL_FROM || '"DietKaro" <noreply@dietkaro.com>',
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
    };

    if (!transporter) {
        // Development mode - just log the email
        logger.info('Email would be sent (dev mode):', {
            to: options.to,
            subject: options.subject,
            hasAttachments: !!options.attachments?.length,
        });
        return true;
    }

    try {
        const info = await transporter.sendMail(mailOptions);
        logger.info('Email sent successfully', {
            messageId: info.messageId,
            to: options.to,
        });
        return true;
    } catch (error) {
        logger.error('Failed to send email', { error, to: options.to });
        return false;
    }
}

export function generateDietPlanEmailHtml(
    planName: string,
    clientName: string,
    dietitianName: string,
    previewUrl?: string
): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; padding: 20px 0;">
        <h1 style="color: #17cf54; margin: 0;">🥗 DietKaro</h1>
    </div>
    
    <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin: 20px 0;">
        <h2 style="margin-top: 0;">Hello ${clientName}! 👋</h2>
        <p>Your personalized diet plan <strong>"${planName}"</strong> is ready!</p>
        <p>Your dietitian ${dietitianName} has created this plan especially for you. Please find your detailed meal plan attached as a PDF.</p>
    </div>
    
    ${previewUrl ? `
    <div style="text-align: center; margin: 24px 0;">
        <a href="${previewUrl}" style="display: inline-block; background: #17cf54; color: #111827; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600;">View Online</a>
    </div>
    ` : ''}
    
    <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h3 style="margin-top: 0; font-size: 14px; color: #6b7280;">Tips for Success:</h3>
        <ul style="margin: 0; padding-left: 20px; color: #374151;">
            <li>Follow the meal times as closely as possible</li>
            <li>Stay hydrated - drink at least 2-3 liters of water daily</li>
            <li>Log your meals in the app to track progress</li>
            <li>Reach out to your dietitian if you have questions</li>
        </ul>
    </div>
    
    <div style="text-align: center; padding: 20px 0; color: #9ca3af; font-size: 12px;">
        <p>This email was sent by DietKaro on behalf of ${dietitianName}</p>
        <p>If you have questions, contact your dietitian or reply to this email.</p>
    </div>
</body>
</html>`;
}
