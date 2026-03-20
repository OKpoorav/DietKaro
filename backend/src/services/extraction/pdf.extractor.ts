// pdf-parse v2 uses a class-based API: new PDFParse({ data: buffer }).getText()
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse');
import { DocumentExtractor, ExtractedContent } from './types';

export class PdfExtractor implements DocumentExtractor {
    readonly mimeTypes = ['application/pdf'] as const;

    async extract(buffer: Buffer): Promise<ExtractedContent> {
        const parser = new PDFParse({ data: buffer });
        try {
            const result = await parser.getText();
            const content = result.text.trim();
            if (!content) throw new Error('PDF extracted no readable text. The file may be image-based or encrypted.');
            return { type: 'text', content };
        } finally {
            await parser.destroy?.();
        }
    }
}
