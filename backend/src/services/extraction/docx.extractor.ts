import mammoth from 'mammoth';
import { DocumentExtractor, ExtractedContent } from './types';

export class DocxExtractor implements DocumentExtractor {
    readonly mimeTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword', // .doc (legacy binary format)
    ] as const;

    async extract(buffer: Buffer): Promise<ExtractedContent> {
        const { value, messages } = await mammoth.extractRawText({ buffer });
        // Warn on conversion warnings but don't throw — partial text is still useful
        if (messages.length > 0) {
            const warnings = messages.filter(m => m.type === 'warning').map(m => m.message);
            if (warnings.length > 0) {
                // Non-fatal: log but proceed
                console.warn('DOCX extraction warnings:', warnings);
            }
        }
        const content = value.trim();
        if (!content) throw new Error('DOCX extracted no text. The file may be empty or corrupted.');
        return { type: 'text', content };
    }
}
