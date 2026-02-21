import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';

export interface ManagementAccountsOutput {
  convertedText: string;
  periodCovered: string;
  transactionCount: number;
  totalCredits: number;
  totalDebits: number;
}

interface MonthExtraction {
  period: string;
  credits: number;
  debits: number;
  openingBal: number;
  closingBal: number;
  topIncome: string[];
  topExpenses: string[];
  error?: string;
}

// Haiku — fast data extraction, no deep reasoning needed
const CONVERSION_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Extract minimal financial summary from a single PDF bank statement.
 * Called in parallel for each file — keeps each call fast and small.
 */
async function extractPDFMonthlyData(
  file: { buffer: Buffer; filename: string },
  businessName: string,
): Promise<MonthExtraction> {
  const client = new Anthropic();
  try {
    const message = await client.messages.create({
      model: CONVERSION_MODEL,
      max_tokens: 600, // Small — just key figures
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: file.buffer.toString('base64'),
            },
            title: file.filename,
          } as Anthropic.Messages.DocumentBlockParam,
          {
            type: 'text',
            text: `Extract from this ${businessName} bank statement. Return ONLY raw JSON, no text, no markdown fences:
{"period":"MMM YYYY","credits":0,"debits":0,"openingBal":0,"closingBal":0,"topIncome":["PayerName: R amount"],"topExpenses":["PayeeName: R amount"]}
Use actual numbers from the statement. topIncome and topExpenses should each have up to 5 entries.`,
          },
        ],
      }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(clean) as MonthExtraction;
    return parsed;
  } catch (e) {
    console.error(`Failed to extract ${file.filename}:`, e);
    return {
      period: file.filename.replace('.pdf', ''),
      credits: 0, debits: 0, openingBal: 0, closingBal: 0,
      topIncome: [], topExpenses: [],
      error: `Could not extract data from ${file.filename}`,
    };
  }
}

/**
 * Build a structured management accounts text document from monthly extractions.
 */
function buildManagementAccountsText(
  months: MonthExtraction[],
  businessName: string,
  sector: string,
): string {
  const validMonths = months.filter(m => m.credits > 0 || m.debits > 0);
  const totalCredits = validMonths.reduce((sum, m) => sum + m.credits, 0);
  const totalDebits  = validMonths.reduce((sum, m) => sum + m.debits,  0);
  const netProfit    = totalCredits - totalDebits;
  const grossMargin  = totalCredits > 0 ? ((totalCredits - totalDebits) / totalCredits * 100).toFixed(1) : '0';
  const openingBal   = validMonths[0]?.openingBal ?? 0;
  const closingBal   = validMonths[validMonths.length - 1]?.closingBal ?? 0;
  const periods      = validMonths.map(m => m.period).filter(Boolean);
  const periodRange  = periods.length > 0 ? `${periods[0]} – ${periods[periods.length - 1]}` : 'Full Year';

  // Aggregate top income/expense categories
  const allIncome   = validMonths.flatMap(m => m.topIncome   ?? []);
  const allExpenses = validMonths.flatMap(m => m.topExpenses ?? []);

  const fmt = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const monthRows = validMonths
    .map(m => `${(m.period || 'Unknown').padEnd(15)} | ${fmt(m.credits).padEnd(14)} | ${fmt(m.debits).padEnd(14)} | ${fmt(m.credits - m.debits)}`)
    .join('\n');

  const failedMonths = months
    .filter(m => m.error)
    .map(m => `- ${m.error}`)
    .join('\n');

  return `=== MANAGEMENT ACCOUNTS ===
Business: ${businessName}
Sector: ${sector}
Period: ${periodRange}
Prepared from: Bank Statement Analysis (${validMonths.length} month${validMonths.length !== 1 ? 's' : ''})
${failedMonths ? `\nNote: Some files could not be processed:\n${failedMonths}\n` : ''}
--- INCOME STATEMENT ---
REVENUE
  Sales / Income (total credits):    ${fmt(totalCredits)}
  Other Income:                      R 0
TOTAL REVENUE:                       ${fmt(totalCredits)}

COST OF SALES
  Cost of Goods Sold / Direct Costs: R 0 (estimated from bank data)
GROSS PROFIT:                        ${fmt(totalCredits)}
GROSS PROFIT MARGIN:                 ~${grossMargin}% (estimate from banking data)

OPERATING EXPENSES
  Total Payments / Expenses:         ${fmt(totalDebits)}
TOTAL OPERATING EXPENSES:            ${fmt(totalDebits)}

NET PROFIT / (LOSS):                 ${fmt(netProfit)}
NET PROFIT MARGIN:                   ${grossMargin}%

--- CASH FLOW SUMMARY ---
Opening Balance:                     ${fmt(openingBal)}
Total Receipts (Credits):            ${fmt(totalCredits)}
Total Payments (Debits):             ${fmt(totalDebits)}
Closing Balance:                     ${fmt(closingBal)}
Net Cash Movement:                   ${fmt(closingBal - openingBal)}

--- MONTHLY BREAKDOWN ---
Month           | Total Credits  | Total Debits   | Net
${monthRows}

--- TOP INCOME SOURCES (across all months) ---
${allIncome.slice(0, 10).map(s => `- ${s}`).join('\n') || '- No income data extracted'}

--- TOP EXPENSE CATEGORIES (across all months) ---
${allExpenses.slice(0, 10).map(s => `- ${s}`).join('\n') || '- No expense data extracted'}

=== END OF MANAGEMENT ACCOUNTS ===`;
}

/**
 * Convert bank statement files into structured management accounts.
 *
 * For PDFs: each file is processed independently and in PARALLEL with Haiku
 *   (11 files run concurrently — total time ≈ slowest single file, not sum of all)
 * For Excel/CSV: text extracted via xlsx
 */
export async function convertBankStatementsToManagementAccounts(
  files: Array<{ buffer: Buffer; filename: string }>,
  businessName: string,
  sector: string,
): Promise<ManagementAccountsOutput> {

  const pdfFiles   = files.filter(f => f.filename.toLowerCase().endsWith('.pdf'));
  const otherFiles = files.filter(f => !f.filename.toLowerCase().endsWith('.pdf'));

  // ── PDFs: parallel extraction (all run simultaneously) ────────────────────
  let monthExtractions: MonthExtraction[] = [];
  if (pdfFiles.length > 0) {
    console.log(`Extracting data from ${pdfFiles.length} PDFs in parallel...`);
    monthExtractions = await Promise.all(
      pdfFiles.map(file => extractPDFMonthlyData(file, businessName))
    );
    console.log(`Parallel extraction complete.`);
  }

  // ── Excel/CSV: text extraction via xlsx ───────────────────────────────────
  let extraText = '';
  for (const file of otherFiles) {
    const ext = file.filename.toLowerCase().split('.').pop() || '';
    if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
      try {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          extraText += `\n=== ${file.filename} / ${sheetName} ===\n`;
          extraText += XLSX.utils.sheet_to_csv(sheet).substring(0, 4000);
        });
      } catch { /* ignore */ }
    } else if (ext === 'csv') {
      extraText += `\n=== ${file.filename} ===\n${file.buffer.toString('utf-8').substring(0, 4000)}`;
    }
  }

  // ── Build management accounts text ────────────────────────────────────────
  let convertedText = buildManagementAccountsText(monthExtractions, businessName, sector);
  if (extraText) convertedText += `\n\n--- ADDITIONAL DATA ---\n${extraText}`;

  // Aggregate stats
  const totalCredits = monthExtractions.reduce((s, m) => s + (m.credits || 0), 0);
  const totalDebits  = monthExtractions.reduce((s, m) => s + (m.debits  || 0), 0);
  const periods      = monthExtractions.map(m => m.period).filter(Boolean);
  const periodCovered = periods.length > 0
    ? `${periods[0]} – ${periods[periods.length - 1]}`
    : (files.length > 0 ? 'Submitted period' : 'Full Year');

  return {
    convertedText,
    periodCovered,
    transactionCount: monthExtractions.length * 30,
    totalCredits,
    totalDebits,
  };
}
