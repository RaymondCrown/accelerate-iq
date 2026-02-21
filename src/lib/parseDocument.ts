// NOTE: This file is no longer used by the main analysis pipeline.
// PDFs are now sent directly to Claude as document blocks (no text extraction needed).
// Excel/CSV extraction is handled inline in convertBankStatements.ts and analyzeFinancials.ts.
// Kept for potential future use.

import * as XLSX from 'xlsx';

export interface ParsedDocument {
  text: string;
  type: 'pdf' | 'excel' | 'csv' | 'unknown';
  filename: string;
}

export async function parseDocument(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  const ext = filename.toLowerCase().split('.').pop() || '';

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

  return { text: buffer.toString('utf-8'), type: 'unknown', filename };
}
