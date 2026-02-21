import Anthropic from '@anthropic-ai/sdk';

export interface ManagementAccountsOutput {
  convertedText: string;
  periodCovered: string;
  transactionCount: number;
  totalCredits: number;
  totalDebits: number;
}

export async function convertBankStatementsToManagementAccounts(
  bankStatementText: string,
  businessName: string,
  sector: string,
  model: string = 'claude-sonnet-4-5-20250929'
): Promise<ManagementAccountsOutput> {
  const client = new Anthropic();

  // Step 1: Extract and categorise transactions
  const extractionPrompt = `You are a financial analyst converting raw bank statement data into structured management accounts for ${businessName} in the ${sector} sector.

Analyse the following bank statement text and extract all transactions. Then categorise them into standard accounting categories and build a full set of management accounts.

Bank Statement Data:
${bankStatementText.substring(0, 20000)}

Produce a complete set of management accounts in the following structured format. Use the actual figures from the bank statements — estimate reasonably where data is ambiguous. Return ONLY a plain text document (no JSON, no markdown headers with #, just a clean financial document):

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
[For each month detected in the statements, list:]
Month | Total Credits | Total Debits | Net
[e.g.:]
March 2024     | R 185,000 | R 162,000 | R 23,000
April 2024     | R 210,000 | R 178,000 | R 32,000
[continue for all months...]

--- KEY OBSERVATIONS ---
- [2-3 notable patterns or anomalies found in the transactions]
- [e.g. "Large irregular payment of R45,000 in June — possible equipment purchase"]
- [e.g. "Revenue peaks in December and January consistent with seasonal trading"]

--- TRANSACTION CATEGORIES IDENTIFIED ---
Revenue sources: [list types of incoming payments identified]
Major expense categories: [list types of outgoing payments identified]
Irregular/one-off items: [list any unusual transactions]

=== END OF MANAGEMENT ACCOUNTS ===`;

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: extractionPrompt }],
  });

  const convertedText = message.content[0].type === 'text' ? message.content[0].text : '';

  // Extract summary stats using a quick regex parse of the converted text
  const creditMatch = convertedText.match(/Total Receipts[^R]*R\s*([\d,]+)/i);
  const debitMatch = convertedText.match(/Total Payments[^R]*R\s*([\d,]+)/i);
  const periodMatch = convertedText.match(/Period:\s*(.+)/i);

  const totalCredits = creditMatch ? parseInt(creditMatch[1].replace(/,/g, '')) : 0;
  const totalDebits = debitMatch ? parseInt(debitMatch[1].replace(/,/g, '')) : 0;
  const periodCovered = periodMatch ? periodMatch[1].trim() : 'Full Year';

  // Rough transaction count from monthly rows
  const monthlyRows = convertedText.match(/\d{4}\s*\|/g);
  const transactionCount = monthlyRows ? monthlyRows.length * 30 : 0; // estimate

  return {
    convertedText,
    periodCovered,
    transactionCount,
    totalCredits,
    totalDebits,
  };
}
