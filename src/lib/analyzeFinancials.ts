import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';

export interface FinancialAnalysis {
  businessName: string;
  period: string;
  healthScore: number;
  healthGrade: string;
  healthSummary: string;
  kpis: {
    revenue: string;
    revenueChange: string;
    revenueChangePositive: boolean;
    grossMargin: string;
    grossMarginVsSector: string;
    grossMarginPositive: boolean;
    netMargin: string;
    netMarginVsSector: string;
    netMarginPositive: boolean;
    currentRatio: string;
    currentRatioNote: string;
    currentRatioPositive: boolean;
    cashRunway: string;
    cashRunwayNote: string;
    cashRunwayPositive: boolean;
    debtToEquity: string;
    debtToEquityNote: string;
    debtToEquityPositive: boolean;
  };
  monthlyData: Array<{
    month: string;
    revenue: number;
    expenses: number;
  }>;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
  }>;
  supportAreas: Array<{
    icon: string;
    label: string;
    level: 'urgent' | 'recommended' | 'optional';
  }>;
  executiveSummary: string;
  keyStrengths: string[];
  keyRisks: string[];
}

// Sonnet is used for all financial analysis — requires deep reasoning and structured output
const ANALYSIS_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Analyse financial documents. Accepts either:
 *   - An array of raw file buffers (PDFs sent as document blocks, Excel/CSV as text)
 *   - A plain text string (e.g. output from the bank statement conversion step)
 */
export async function analyzeFinancials(
  input: Array<{ buffer: Buffer; filename: string }> | string,
  businessName: string,
  sector: string,
  stage: string,
  yearEnd: string,
  inputType: 'management' | 'bank',
): Promise<FinancialAnalysis> {
  const client = new Anthropic();

  const promptSuffix = `You are a senior financial analyst at an entrepreneurial accelerator. Analyse the financial documents above for ${businessName} and provide a comprehensive assessment.

Business Context:
- Business Name: ${businessName}
- Sector: ${sector}
- Stage: ${stage}
- Financial Year End: ${yearEnd}
- Document Type: ${inputType === 'management' ? 'Management Accounts' : 'Converted Bank Statements'}

Provide a detailed financial health analysis. Return ONLY a valid JSON object (no markdown, no code blocks, just raw JSON):

{
  "businessName": "${businessName}",
  "period": "FY ${yearEnd}",
  "healthScore": <number 0-100>,
  "healthGrade": "<Excellent|Good|Moderate|Concerning|Critical>",
  "healthSummary": "<2-sentence summary of overall financial health>",
  "kpis": {
    "revenue": "<formatted revenue e.g. R 2.4M>",
    "revenueChange": "<e.g. ↑ 18% YoY or N/A>",
    "revenueChangePositive": <true/false>,
    "grossMargin": "<e.g. 34%>",
    "grossMarginVsSector": "<e.g. ↓ 4pp below sector avg (38%)>",
    "grossMarginPositive": <true/false>,
    "netMargin": "<e.g. 7.2%>",
    "netMarginVsSector": "<e.g. ≈ sector avg (7%)>",
    "netMarginPositive": <true/false>,
    "currentRatio": "<e.g. 1.3×>",
    "currentRatioNote": "<brief note>",
    "currentRatioPositive": <true/false>,
    "cashRunway": "<e.g. 3.1 mo>",
    "cashRunwayNote": "<brief note>",
    "cashRunwayPositive": <true/false>,
    "debtToEquity": "<e.g. 0.8×>",
    "debtToEquityNote": "<brief note>",
    "debtToEquityPositive": <true/false>
  },
  "monthlyData": [
    {"month": "Jan", "revenue": <number>, "expenses": <number>},
    {"month": "Feb", "revenue": <number>, "expenses": <number>},
    {"month": "Mar", "revenue": <number>, "expenses": <number>},
    {"month": "Apr", "revenue": <number>, "expenses": <number>},
    {"month": "May", "revenue": <number>, "expenses": <number>},
    {"month": "Jun", "revenue": <number>, "expenses": <number>},
    {"month": "Jul", "revenue": <number>, "expenses": <number>},
    {"month": "Aug", "revenue": <number>, "expenses": <number>},
    {"month": "Sep", "revenue": <number>, "expenses": <number>},
    {"month": "Oct", "revenue": <number>, "expenses": <number>},
    {"month": "Nov", "revenue": <number>, "expenses": <number>},
    {"month": "Dec", "revenue": <number>, "expenses": <number>}
  ],
  "recommendations": [
    {"priority": "high",   "title": "<title>", "description": "<1-2 sentence recommendation>"},
    {"priority": "medium", "title": "<title>", "description": "<1-2 sentence recommendation>"},
    {"priority": "low",    "title": "<title>", "description": "<1-2 sentence recommendation>"}
  ],
  "supportAreas": [
    {"icon": "💰", "label": "Cash Flow Management",   "level": "urgent"},
    {"icon": "📋", "label": "Financial Reporting",    "level": "recommended"},
    {"icon": "📈", "label": "Growth Strategy",        "level": "optional"}
  ],
  "executiveSummary": "<3-4 paragraph executive summary>",
  "keyStrengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "keyRisks":    ["<risk 1>",     "<risk 2>",     "<risk 3>"]
}

Important: Base your analysis on the actual document content. Estimate where data is limited and note assumptions. Always provide useful insights even with partial data. Monthly revenue/expense numbers must be realistic relative to the total revenue.`;

  // Build content blocks
  let contentBlocks: Anthropic.Messages.ContentBlockParam[];

  if (typeof input === 'string') {
    // Plain text input (e.g. output from bank statement conversion)
    contentBlocks = [
      { type: 'text', text: `Financial Documents:\n\n${input.substring(0, 15000)}` },
      { type: 'text', text: promptSuffix },
    ];
  } else {
    // File array — send PDFs as document blocks, Excel/CSV as text
    contentBlocks = [];
    for (const file of input) {
      const ext = file.filename.toLowerCase().split('.').pop() || '';
      if (ext === 'pdf') {
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
    contentBlocks.push({ type: 'text', text: promptSuffix });
  }

  const message = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: contentBlocks }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  // Strip any markdown code fences if present
  const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleanJson) as FinancialAnalysis;
  } catch (e) {
    console.error('JSON parse error:', e, 'Response:', cleanJson.substring(0, 500));
    throw new Error('Failed to parse AI analysis response');
  }
}
