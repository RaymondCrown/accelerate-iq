import { NextRequest, NextResponse } from 'next/server';
import { parseDocument } from '@/lib/parseDocument';
import { analyzeFinancials } from '@/lib/analyzeFinancials';
import { convertBankStatementsToManagementAccounts } from '@/lib/convertBankStatements';

export const maxDuration = 300; // 5 minutes (Vercel/Netlify Pro)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const businessName = formData.get('businessName') as string || 'Unknown Business';
    const sector = formData.get('sector') as string || 'General';
    const stage = formData.get('stage') as string || 'Growth Stage';
    const yearEnd = formData.get('yearEnd') as string || 'December 2025';
    const inputType = (formData.get('inputType') as string || 'management') as 'management' | 'bank';
    const model = formData.get('model') as string || 'claude-sonnet-4-5-20250929';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    // Parse all documents
    const parsedDocs = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return parseDocument(buffer, file.name);
      })
    );

    // Combine all document text
    const combinedText = parsedDocs
      .map(doc => `\n\n=== Document: ${doc.filename} ===\n${doc.text}`)
      .join('\n');

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
      // Return mock data for demo purposes when no API key is set
      return NextResponse.json(getMockAnalysis(businessName, sector, stage, yearEnd));
    }

    // For bank statements: run two-stage pipeline
    // Stage 1 — Convert bank statements → management accounts
    // Stage 2 — Analyse the converted management accounts
    let textToAnalyse = combinedText;
    let conversionNote = '';

    if (inputType === 'bank') {
      try {
        console.log('Bank statements detected — running conversion to management accounts...');
        const converted = await convertBankStatementsToManagementAccounts(
          combinedText,
          businessName,
          sector,
          model
        );
        textToAnalyse = converted.convertedText;
        conversionNote = `[Converted from bank statements covering ${converted.periodCovered}] `;
        console.log(`Conversion complete. Period: ${converted.periodCovered}`);
      } catch (conversionError) {
        console.error('Bank statement conversion failed, proceeding with raw text:', conversionError);
        // Fall through and analyse raw bank statement text directly
      }
    }

    // Analyse with Claude
    try {
      const analysis = await analyzeFinancials(
        textToAnalyse,
        businessName,
        sector,
        stage,
        yearEnd,
        inputType === 'bank' ? 'management' : inputType, // treat converted output as management accounts
        model
      );
      // Prepend conversion note to summary if applicable
      if (conversionNote) {
        analysis.healthSummary = conversionNote + analysis.healthSummary;
      }
      return NextResponse.json(analysis);
    } catch (apiError) {
      console.error('AI analysis failed, falling back to demo data:', apiError);
      // Fall back to mock analysis if API call fails (e.g. insufficient credits)
      const mock = getMockAnalysis(businessName, sector, stage, yearEnd);
      mock.healthSummary = `[Demo Mode — API key has insufficient credits] ${mock.healthSummary}`;
      return NextResponse.json(mock);
    }
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

function getMockAnalysis(businessName: string, sector: string, stage: string, yearEnd: string) {
  return {
    businessName,
    period: `FY ${yearEnd}`,
    healthScore: 67,
    healthGrade: 'Moderate',
    healthSummary: `${businessName} shows strong revenue growth momentum but faces cash flow pressure and margin challenges typical for ${stage.toLowerCase()} businesses in the ${sector} sector.`,
    kpis: {
      revenue: 'R 2.4M',
      revenueChange: '↑ 18% YoY',
      revenueChangePositive: true,
      grossMargin: '34%',
      grossMarginVsSector: '↓ 4pp below sector avg (38%)',
      grossMarginPositive: false,
      netMargin: '7.2%',
      netMarginVsSector: '≈ sector avg (7%)',
      netMarginPositive: true,
      currentRatio: '1.3×',
      currentRatioNote: 'Below healthy threshold of 2×',
      currentRatioPositive: false,
      cashRunway: '3.1 mo',
      cashRunwayNote: '⚠ Low — action needed',
      cashRunwayPositive: false,
      debtToEquity: '0.8×',
      debtToEquityNote: '✓ Within healthy range',
      debtToEquityPositive: true,
    },
    monthlyData: [
      { month: 'Jan', revenue: 165000, expenses: 140000 },
      { month: 'Feb', revenue: 175000, expenses: 148000 },
      { month: 'Mar', revenue: 180000, expenses: 152000 },
      { month: 'Apr', revenue: 195000, expenses: 158000 },
      { month: 'May', revenue: 190000, expenses: 162000 },
      { month: 'Jun', revenue: 210000, expenses: 170000 },
      { month: 'Jul', revenue: 205000, expenses: 168000 },
      { month: 'Aug', revenue: 220000, expenses: 175000 },
      { month: 'Sep', revenue: 215000, expenses: 178000 },
      { month: 'Oct', revenue: 235000, expenses: 185000 },
      { month: 'Nov', revenue: 230000, expenses: 190000 },
      { month: 'Dec', revenue: 380000, expenses: 275000 },
    ],
    recommendations: [
      {
        priority: 'high',
        title: 'Cash Runway Critical',
        description: 'Only 3.1 months of cash reserves. Immediately review debtor collections and consider short-term working capital financing to extend runway to at least 6 months.',
      },
      {
        priority: 'medium',
        title: 'Gross Margin Below Sector',
        description: 'Margin is 4pp below the sector benchmark. Review raw material costs and supplier contracts to identify quick wins in COGS reduction.',
      },
      {
        priority: 'low',
        title: 'Revenue Growth Strong',
        description: '18% YoY growth is above sector average. Invest in sales capacity to sustain this momentum and develop a formal revenue forecast model.',
      },
    ],
    supportAreas: [
      { icon: '💰', label: 'Cash Flow Management', level: 'urgent' },
      { icon: '📋', label: 'Debtor Management & Collections', level: 'urgent' },
      { icon: '📊', label: 'Pricing & Margin Optimisation', level: 'recommended' },
      { icon: '🏦', label: 'Working Capital Financing', level: 'recommended' },
      { icon: '📈', label: 'Financial Reporting & Forecasting', level: 'recommended' },
      { icon: '🌱', label: 'Growth Strategy & Planning', level: 'optional' },
    ],
    executiveSummary: `${businessName} is a ${stage.toLowerCase()} business in the ${sector} sector demonstrating strong commercial momentum with 18% year-on-year revenue growth. The business has successfully grown its top line, indicating solid market traction and product-market fit.\n\nHowever, the business faces significant short-term financial pressure. Cash runway of only 3.1 months is a critical concern that requires immediate management attention. The current ratio of 1.3× is below the healthy threshold of 2×, indicating potential liquidity constraints if growth continues at this pace without additional working capital.\n\nGross margins at 34% are 4 percentage points below the sector average of 38%. This gap, while not alarming, represents a meaningful opportunity to improve profitability through better procurement practices, pricing strategy, and operational efficiency.\n\nThe accelerator should prioritise connecting this business with mentors and resources focused on cash flow management, debtor collections, and working capital solutions to ensure the strong revenue trajectory is not interrupted by a liquidity event.`,
    keyStrengths: [
      '18% YoY revenue growth significantly above sector average',
      'Net profit margin in line with sector benchmarks',
      'Manageable debt-to-equity ratio of 0.8×',
    ],
    keyRisks: [
      'Critical: Cash runway of only 3.1 months',
      'Current ratio below healthy threshold — liquidity risk',
      'Gross margin 4pp below sector — margin erosion risk',
    ],
  };
}
