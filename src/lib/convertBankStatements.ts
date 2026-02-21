import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';

export interface ManagementAccountsOutput {
  convertedText: string;
  periodCovered: string;
  transactionCount: number;
  totalCredits: number;
  totalDebits: number;
}

// Haiku is used here — fast data-extraction task, no deep reasoning needed
const CONVERSION_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Converts raw bank statement files into structured management accounts text.
 * PDFs are sent directly to Claude as document blocks (no pdf-parse needed).
 * Excel/CSV files are converted to text via xlsx.
 */
export async function convertBankStatementsToManagementAccounts(
  files: Array<{ buffer: Buffer; filename: string }>,
  businessName: string,
  sector: string,
): Promise<ManagementAccountsOutput> {
  const client = new Anthropic();

  // Build content blocks: document blocks for PDFs, text for Excel/CSV
  const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];

  for (const file of files) {
    const ext = file.filename.toLowerCase().split('.').pop() || '';

    if (ext === 'pdf') {
      // Send PDF directly — Claude can read any PDF including scanned ones
      contentBlocks.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: file.buffer.toString('base64'),
        },
        title: file.filename,
      } as Anthropic.Messages.DocumentBlockParam);
    } else if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
      try {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        let text = `=== File: ${file.filename} ===\n`;
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          text += `\n--- Sheet: ${sheetName} ---\n`;
          text += XLSX.utils.sheet_to_csv(sheet);
        });
        contentBlocks.push({ type: 'text', text: text.substring(0, 8000) });
      } catch (e) {
        contentBlocks.push({ type: 'text', text: `[Could not read ${file.filename}: ${e}]` });
      }
    } else if (ext === 'csv') {
      contentBlocks.push({
        type: 'text',
        text: `=== File: ${file.filename} ===\n${file.buffer.toString('utf-8').substring(0, 8000)}`,
      });
    }
  }

  if (contentBlocks.length === 0) {
    throw new Error('No readable bank statement files found');
  }

  // Instruction prompt appended after all document/data blocks
  const instructionPrompt = `You are a financial analyst converting bank statement data into structured management accounts for ${businessName} in the ${sector} sector.

Analyse all the bank statements above and produce a complete set of management accounts. Use the actual figures — estimate reasonably where data is ambiguous. Return a plain text document (no markdown, no # headers):

=== MANAGEMENT ACCOUNTS ===
Business: ${businessName}
Sector: ${sector}
Period: [derive from statement dates, e.g. "March 2024 – February 2025"]
Prepared from: Bank Statement Analysis

--- INCOME STATEMENT ---
REVENUE
  Sales / Income:                    R [amount]
  Other Income:                      R [amount]
TOTAL REVENUE:                       R [amount]

COST OF SALES
  Cost of Goods Sold / Direct Costs: R [amount]
GROSS PROFIT:                        R [amount]
GROSS PROFIT MARGIN:                 [%]

OPERATING EXPENSES
  Salaries & Wages:                  R [amount]
  Rent & Occupancy:                  R [amount]
  Utilities:                         R [amount]
  Bank Charges & Fees:               R [amount]
  Marketing & Advertising:           R [amount]
  Insurance:                         R [amount]
  Professional Fees:                 R [amount]
  Loan Repayments / Interest:        R [amount]
  Other Operating Expenses:          R [amount]
TOTAL OPERATING EXPENSES:            R [amount]

NET PROFIT / (LOSS):                 R [amount]
NET PROFIT MARGIN:                   [%]

--- CASH FLOW SUMMARY ---
Opening Balance:                     R [amount]
Total Receipts (Credits):            R [amount]
Total Payments (Debits):             R [amount]
Closing Balance:                     R [amount]
Net Cash Movement:                   R [amount]

--- MONTHLY BREAKDOWN ---
[For each month in the statements:]
Month | Total Credits | Total Debits | Net
March 2024     | R 185,000 | R 162,000 | R 23,000
[continue for all months...]

--- KEY OBSERVATIONS ---
- [2-3 notable patterns or anomalies in the transactions]

--- TRANSACTION CATEGORIES IDENTIFIED ---
Revenue sources: [types of incoming payments]
Major expense categories: [types of outgoing payments]
Irregular/one-off items: [unusual transactions]

=== END OF MANAGEMENT ACCOUNTS ===`;

  contentBlocks.push({ type: 'text', text: instructionPrompt });

  const message = await client.messages.create({
    model: CONVERSION_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: contentBlocks }],
  });

  const convertedText = message.content[0].type === 'text' ? message.content[0].text : '';

  // Extract summary stats via regex
  const creditMatch = convertedText.match(/Total Receipts[^R]*R\s*([\d,]+)/i);
  const debitMatch  = convertedText.match(/Total Payments[^R]*R\s*([\d,]+)/i);
  const periodMatch = convertedText.match(/Period:\s*(.+)/i);

  const totalCredits    = creditMatch ? parseInt(creditMatch[1].replace(/,/g, '')) : 0;
  const totalDebits     = debitMatch  ? parseInt(debitMatch[1].replace(/,/g, ''))  : 0;
  const periodCovered   = periodMatch ? periodMatch[1].trim() : 'Full Year';
  const monthlyRows     = convertedText.match(/\d{4}\s*\|/g);
  const transactionCount = monthlyRows ? monthlyRows.length * 30 : 0;

  return { convertedText, periodCovered, transactionCount, totalCredits, totalDebits };
}
