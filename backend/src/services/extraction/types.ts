/**
 * Common interface for all document extractors.
 * Each extractor converts a raw Buffer into one of two forms:
 *  - 'text'       for PDFs and DOCX — free-form text
 *  - 'structured' for CSV — array of row objects already parsed into JSON
 */

export type ExtractedContent =
    | { type: 'text'; content: string }
    | { type: 'structured'; content: Record<string, string>[] };

export interface DocumentExtractor {
    /** MIME types this extractor handles */
    readonly mimeTypes: readonly string[];
    extract(buffer: Buffer): Promise<ExtractedContent>;
}
