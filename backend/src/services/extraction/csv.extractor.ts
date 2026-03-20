import { parse } from 'csv-parse/sync';
import { DocumentExtractor, ExtractedContent } from './types';

export class CsvExtractor implements DocumentExtractor {
    readonly mimeTypes = [
        'text/csv',
        'application/csv',
        'application/vnd.ms-excel', // .xls sometimes reported as this
        'text/plain',               // some clients send CSV as text/plain
    ] as const;

    async extract(buffer: Buffer): Promise<ExtractedContent> {
        const records = parse(buffer.toString('utf-8'), {
            columns: true,        // first row is header
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true, // tolerate ragged rows
        }) as Record<string, string>[];

        if (records.length === 0) throw new Error('CSV contains no data rows.');
        return { type: 'structured', content: records };
    }
}
