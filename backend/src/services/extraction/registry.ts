import { DocumentExtractor, ExtractedContent } from './types';
import { PdfExtractor } from './pdf.extractor';
import { DocxExtractor } from './docx.extractor';
import { CsvExtractor } from './csv.extractor';

const EXTRACTORS: DocumentExtractor[] = [
    new PdfExtractor(),
    new DocxExtractor(),
    new CsvExtractor(),
];

/** Returns the extractor for a given MIME type, or null if unsupported */
export function findExtractor(mimeType: string): DocumentExtractor | null {
    return EXTRACTORS.find(e => (e.mimeTypes as readonly string[]).includes(mimeType)) ?? null;
}

/** Returns true if we can process this MIME type */
export function isSupportedMimeType(mimeType: string): boolean {
    return findExtractor(mimeType) !== null;
}

/** Extract content from a buffer. Throws if MIME type is unsupported. */
export async function extractContent(buffer: Buffer, mimeType: string): Promise<ExtractedContent> {
    const extractor = findExtractor(mimeType);
    if (!extractor) {
        throw new Error(`No extractor registered for MIME type: ${mimeType}`);
    }
    return extractor.extract(buffer);
}
