import * as XLSX from 'xlsx';

export interface ParsedDocument {
  text: string;
  type: 'pdf' | 'excel' | 'csv' | 'unknown';
  filename: string;
}

export async function parseDocument(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  const ext = filename.toLowerCase().split('.').pop() || '';

  if (ext === 'pdf') {
    try {
      // Use the internal lib path to avoid pdf-parse's test-file access issue in serverless
      // (the default import tries to read local test PDFs during init, which crashes in serverless)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (buf: Buffer) => Promise<{ text: string }>;
      const data = await pdfParse(buffer);
      return { text: data.text, type: 'pdf', filename };
    } catch (e) {
      console.error('PDF parse error:', e);
      return { text: `[PDF parsing error: ${e}]`, type: 'pdf', filename };
    }
  }

  if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let text = '';
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        text += `\n=== Sheet: ${sheetName} ===\n`;
        text += XLSX.utils.sheet_to_csv(sheet);
      });
      return { text, type: 'excel', filename };
    } catch (e) {
      return { text: `[Excel parsing error: ${e}]`, type: 'excel', filename };
    }
  }

  if (ext === 'csv') {
    return { text: buffer.toString('utf-8'), type: 'csv', filename };
  }

  // Try as plain text
  return { text: buffer.toString('utf-8'), type: 'unknown', filename };
}
