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
      // Dynamic import to avoid SSR issues
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = (pdfParseModule as any).default || (pdfParseModule as any);
      const data = await pdfParse(buffer);
      return { text: data.text, type: 'pdf', filename };
    } catch (e) {
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

  // Try as text
  return { text: buffer.toString('utf-8'), type: 'unknown', filename };
}
