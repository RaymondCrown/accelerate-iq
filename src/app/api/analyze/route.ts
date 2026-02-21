import { NextRequest, NextResponse } from 'next/server';
import { analyzeFinancials } from '@/lib/analyzeFinancials';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Accepts pre-extracted data (from /api/extract calls) — NOT raw files.
 * Keeps this request tiny (text only, no PDFs) so it never hits the 4.5MB limit.
 *
 * Body (JSON):
 *   businessName, sector, stage, yearEnd, inputType
 *   extractions: Array of objects returned by /api/extract
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      businessName: string;
      sector:       string;
      stage:        string;
      yearEnd:      string;
      inputType:    'management' | 'bank';
      extractions:  Array<Record<string, unknown>>;
    };

    const { businessName, sector, stage, yearEnd, inputType, extractions } = body;

    if (!extractions || extractions.length === 0) {
      return NextResponse.json({ error: 'No extracted data provided' }, { status: 400 });
    }

    // Check API key — return clearly-labelled demo data if not configured
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
      const mock = getMockAnalysis(businessName, sector, stage, yearEnd);
      mock.healthSummary = `⚠️ DEMO MODE — No API key configured on this server. Set ANTHROPIC_API_KEY in your Vercel environment variables and redeploy. ${mock.healthSummary}`;
      return NextResponse.json(mock);
    }

    // Build combined text from extractions
    let combinedText: string;
    let conversionNote = '';

    if (inputType === 'bank') {
      combinedText  = buildManagementAccountsFromExtractions(extractions, businessName, sector);
      const periods = extractions
        .filter(e => e.type === 'monthly' && e.period)
        .map(e => e.period as string);
      if (periods.length > 0) {
        conversionNote = `[Converted from ${periods.length} bank statement(s): ${periods[0]} – ${periods[periods.length - 1]}] `;
      }
    } else {
      // Management accounts: concatenate all raw text extractions
      combinedText = extractions
        .map(e => `\n\n=== ${e.filename ?? 'Document'} ===\n${e.rawText ?? ''}`)
        .join('\n');
    }

    try {
      const analysis = await analyzeFinancials(
        combinedText,
        businessName,
        sector,
        stage,
        yearEnd,
        inputType === 'bank' ? 'management' : inputType,
      );
      if (conversionNote) {
        analysis.healthSummary = conversionNote + analysis.healthSummary;
      }
      return NextResponse.json(analysis);
    } catch (apiError) {
      console.error('AI analysis failed, falling back to demo:', apiError);
      const mock = getMockAnalysis(businessName, sector, stage, yearEnd);
      mock.healthSummary = `[Demo Mode — API error] ${mock.healthSummary}`;
      return NextResponse.json(mock);
    }

  } catch (error) {
    console.error('Analyze route error:', error);
    return NextResponse.json(
      { error: `Analysis failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildManagementAccountsFromExtractions(
  extractions: Array<Record<string, unknown>>,
  businessName: string,
  sector: string,
): string {
  const monthly = extractions.filter(e => e.type === 'monthly');
  const texts   = extractions.filter(e => e.type === 'text');

  const totalCredits = monthly.reduce((s, m) => s + ((m.credits as number) || 0), 0);
  const totalDebits  = monthly.reduce((s, m) => s + ((m.debits  as number) || 0), 0);
  const netProfit    = totalCredits - totalDebits;
  const openingBal   = (monthly[0]?.openingBal as number) ?? 0;
  const closingBal   = (monthly[monthly.length - 1]?.closingBal as number) ?? 0;
  const periods      = monthly.map(m => m.period as string).filter(Boolean);
  const periodRange  = periods.length > 0 ? `${periods[0]} – ${periods[periods.length - 1]}` : 'Full Year';
  const grossMargin  = totalCredits > 0 ? ((netProfit / totalCredits) * 100).toFixed(1) : '0';

  const fmt = (n: number) =>
    `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const monthRows = monthly
    .map(m => {
      const c = (m.credits as number) || 0;
      const d = (m.debits  as number) || 0;
      return `${String(m.period || 'Unknown').padEnd(15)} | ${fmt(c).padEnd(14)} | ${fmt(d).padEnd(14)} | ${fmt(c - d)}`;
    })
    .join('\n');

  const allIncome   = monthly.flatMap(m => (m.topIncome   as string[]) ?? []);
  const allExpenses = monthly.flatMap(m => (m.topExpenses as string[]) ?? []);

  let result = `=== MANAGEMENT ACCOUNTS ===
Business: ${businessName}
Sector: ${sector}
Period: ${periodRange}
Prepared from: Bank Statement Analysis (${monthly.length} month${monthly.length !== 1 ? 's' : ''})

--- INCOME STATEMENT ---
TOTAL REVENUE (bank credits):        ${fmt(totalCredits)}
TOTAL EXPENSES (bank debits):        ${fmt(totalDebits)}
NET PROFIT / (LOSS):                 ${fmt(netProfit)}
NET PROFIT MARGIN:                   ${grossMargin}%

--- CASH FLOW SUMMARY ---
Opening Balance:                     ${fmt(openingBal)}
Total Receipts (Credits):            ${fmt(totalCredits)}
Total Payments (Debits):             ${fmt(totalDebits)}
Closing Balance:                     ${fmt(closingBal)}

--- MONTHLY BREAKDOWN ---
Month           | Total Credits  | Total Debits   | Net
${monthRows}

--- TOP INCOME SOURCES ---
${allIncome.slice(0, 10).map(s => `- ${s}`).join('\n') || '- No income data'}

--- TOP EXPENSE CATEGORIES ---
${allExpenses.slice(0, 10).map(s => `- ${s}`).join('\n') || '- No expense data'}

=== END OF MANAGEMENT ACCOUNTS ===`;

  if (texts.length > 0) {
    result += '\n\n--- ADDITIONAL DOCUMENTS ---\n';
    texts.forEach(t => {
      result += `\n=== ${t.filename ?? 'Document'} ===\n${(t.rawText as string ?? '').substring(0, 4000)}`;
    });
  }

  return result;
}

function getMockAnalysis(businessName: string, sector: string, stage: string, yearEnd: string) {
  return {
    businessName, period: `FY ${yearEnd}`,
    healthScore: 67, healthGrade: 'Moderate',
    healthSummary: `${businessName} shows strong revenue growth momentum but faces cash flow pressure typical for ${stage.toLowerCase()} businesses in the ${sector} sector.`,
    kpis: {
      revenue: 'R 2.4M', revenueChange: '↑ 18% YoY', revenueChangePositive: true,
      grossMargin: '34%', grossMarginVsSector: '↓ 4pp below sector avg (38%)', grossMarginPositive: false,
      netMargin: '7.2%', netMarginVsSector: '≈ sector avg (7%)', netMarginPositive: true,
      currentRatio: '1.3×', currentRatioNote: 'Below healthy threshold of 2×', currentRatioPositive: false,
      cashRunway: '3.1 mo', cashRunwayNote: '⚠ Low — action needed', cashRunwayPositive: false,
      debtToEquity: '0.8×', debtToEquityNote: '✓ Within healthy range', debtToEquityPositive: true,
    },
    monthlyData: [
      { month: 'Jan', revenue: 165000, expenses: 140000 }, { month: 'Feb', revenue: 175000, expenses: 148000 },
      { month: 'Mar', revenue: 180000, expenses: 152000 }, { month: 'Apr', revenue: 195000, expenses: 158000 },
      { month: 'May', revenue: 190000, expenses: 162000 }, { month: 'Jun', revenue: 210000, expenses: 170000 },
      { month: 'Jul', revenue: 205000, expenses: 168000 }, { month: 'Aug', revenue: 220000, expenses: 175000 },
      { month: 'Sep', revenue: 215000, expenses: 178000 }, { month: 'Oct', revenue: 235000, expenses: 185000 },
      { month: 'Nov', revenue: 230000, expenses: 190000 }, { month: 'Dec', revenue: 380000, expenses: 275000 },
    ],
    recommendations: [
      { priority: 'high',   title: 'Cash Runway Critical',     description: 'Only 3.1 months of cash. Review debtor collections and consider working capital financing.' },
      { priority: 'medium', title: 'Gross Margin Below Sector', description: 'Margin 4pp below benchmark. Review COGS and supplier contracts.' },
      { priority: 'low',    title: 'Revenue Growth Strong',     description: '18% YoY growth above sector average. Invest in sales capacity.' },
    ],
    supportAreas: [
      { icon: '💰', label: 'Cash Flow Management',             level: 'urgent' },
      { icon: '📋', label: 'Debtor Management & Collections',  level: 'urgent' },
      { icon: '📊', label: 'Pricing & Margin Optimisation',    level: 'recommended' },
      { icon: '🏦', label: 'Working Capital Financing',        level: 'recommended' },
      { icon: '📈', label: 'Financial Reporting & Forecasting', level: 'recommended' },
      { icon: '🌱', label: 'Growth Strategy & Planning',       level: 'optional' },
    ],
    executiveSummary: `${businessName} is a ${stage.toLowerCase()} business in ${sector} with 18% YoY revenue growth.\n\nCash runway of 3.1 months requires immediate attention. Current ratio of 1.3× is below the healthy threshold.\n\nGross margins at 34% are 4pp below sector average, representing an improvement opportunity.\n\nPrioritise cash flow management and working capital solutions.`,
    keyStrengths: ['18% YoY revenue growth above sector average', 'Net margin in line with benchmarks', 'Manageable debt-to-equity of 0.8×'],
    keyRisks: ['Cash runway of only 3.1 months', 'Current ratio below 2× threshold', 'Gross margin 4pp below sector'],
  };
}
