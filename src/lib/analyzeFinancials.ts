import Anthropic from '@anthropic-ai/sdk';

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

export const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', description: 'Fast & cost-effective' },
  { id: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5', description: 'Most capable' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', description: 'Fastest & cheapest' },
] as const;

export type ModelId = typeof AVAILABLE_MODELS[number]['id'];

export async function analyzeFinancials(
  documentsText: string,
  businessName: string,
  sector: string,
  stage: string,
  yearEnd: string,
  inputType: 'management' | 'bank',
  model: string = 'claude-sonnet-4-5-20250929'
): Promise<FinancialAnalysis> {
  const client = new Anthropic();

  const prompt = `You are a senior financial analyst at an entrepreneurial accelerator. Analyse the following financial documents for ${businessName} and provide a comprehensive assessment.

Business Context:
- Business Name: ${businessName}
- Sector: ${sector}
- Stage: ${stage}
- Financial Year End: ${yearEnd}
- Document Type: ${inputType === 'management' ? 'Management Accounts' : 'Bank Statements'}

Documents Content:
${documentsText.substring(0, 15000)}

Provide a detailed financial health analysis. Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks, just raw JSON):

{
  "businessName": "${businessName}",
  "period": "FY ${yearEnd}",
  "healthScore": <number 0-100>,
  "healthGrade": "<Excellent|Good|Moderate|Concerning|Critical>",
  "healthSummary": "<2-sentence summary of overall financial health>",
  "kpis": {
    "revenue": "<formatted revenue e.g. R 2.4M or estimated if bank statements>",
    "revenueChange": "<e.g. ↑ 18% YoY or N/A if only one period>",
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
    {
      "priority": "high",
      "title": "<short title>",
      "description": "<1-2 sentence actionable recommendation>"
    },
    {
      "priority": "medium",
      "title": "<short title>",
      "description": "<1-2 sentence actionable recommendation>"
    },
    {
      "priority": "low",
      "title": "<short title>",
      "description": "<1-2 sentence actionable recommendation>"
    }
  ],
  "supportAreas": [
    {"icon": "💰", "label": "Cash Flow Management", "level": "urgent"},
    {"icon": "📋", "label": "Financial Reporting", "level": "recommended"},
    {"icon": "📈", "label": "Growth Strategy", "level": "optional"}
  ],
  "executiveSummary": "<3-4 paragraph executive summary of the business financial position>",
  "keyStrengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "keyRisks": ["<risk 1>", "<risk 2>", "<risk 3>"]
}

Important: Base your analysis on the actual document content. If data is limited (e.g. bank statements only), estimate where needed and note assumptions. Always provide useful insights even with partial data. Make sure monthly revenue/expense numbers are realistic relative to total revenue.`;

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  
  // Clean up response - remove any markdown code blocks if present
  const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  try {
    return JSON.parse(cleanJson) as FinancialAnalysis;
  } catch (e) {
    // Return a fallback if parsing fails
    console.error('JSON parse error:', e, 'Response:', cleanJson.substring(0, 500));
    throw new Error('Failed to parse AI analysis response');
  }
}
