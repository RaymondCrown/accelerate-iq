import { NextRequest, NextResponse } from 'next/server';
import { analyzeFinancials } from '@/lib/analyzeFinancials';
import { convertBankStatementsToManagementAccounts } from '@/lib/convertBankStatements';

export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files     = formData.getAll('files') as File[];
    const businessName = formData.get('businessName') as string || 'Unknown Business';
    const sector    = formData.get('sector')    as string || 'General';
    const stage     = formData.get('stage')     as string || 'Growth Stage';
    const yearEnd   = formData.get('yearEnd')   as string || 'December 2025';
    const inputType = (formData.get('inputType') as string || 'management') as 'management' | 'bank';
    // Models are fixed per task: Haiku for bank conversion, Sonnet for analysis

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
      return NextResponse.json(getMockAnalysis(businessName, sector, stage, yearEnd));
    }

    // Load all file buffers once
    const fileBuffers = await Promise.all(
      files.map(async (file) => ({
        buffer:   Buffer.from(await file.arrayBuffer()),
        filename: file.name,
      }))
    );

    if (inputType === 'bank') {
      // ── Stage 1: Haiku converts bank statements → management accounts text ──
      let convertedText: string;
      let conversionNote = '';
      try {
        console.log(`Bank statements detected (${files.length} files) — converting with Haiku...`);
        const converted = await convertBankStatementsToManagementAccounts(
          fileBuffers,
          businessName,
          sector,
        );
        convertedText = converted.convertedText;
        conversionNote = `[Converted from bank statements covering ${converted.periodCovered}] `;
        console.log(`Conversion complete. Period: ${converted.periodCovered}`);
      } catch (conversionError) {
        console.error('Bank statement conversion failed:', conversionError);
        return NextResponse.json(
          { error: `Bank statement conversion failed: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}` },
          { status: 500 }
        );
      }

      // ── Stage 2: Sonnet analyses the converted management accounts text ──
      try {
        const analysis = await analyzeFinancials(
          convertedText,
          businessName,
          sector,
          stage,
          yearEnd,
          'management', // treat converted output as management accounts
        );
        if (conversionNote) {
          analysis.healthSummary = conversionNote + analysis.healthSummary;
        }
        return NextResponse.json(analysis);
      } catch (analysisError) {
        console.error('Analysis failed, falling back to demo:', analysisError);
        const mock = getMockAnalysis(businessName, sector, stage, yearEnd);
        mock.healthSummary = `[Demo Mode — analysis error] ${mock.healthSummary}`;
        return NextResponse.json(mock);
      }

    } else {
      // ── Management accounts: Sonnet reads files directly (document blocks) ──
      try {
        console.log(`Management accounts detected (${files.length} files) — analysing with Sonnet...`);
        const analysis = await analyzeFinancials(
          fileBuffers,
          businessName,
          sector,
          stage,
          yearEnd,
          'management',
        );
        return NextResponse.json(analysis);
      } catch (analysisError) {
        console.error('Analysis failed, falling back to demo:', analysisError);
        const mock = getMockAnalysis(businessName, sector, stage, yearEnd);
        mock.healthSummary = `[Demo Mode — analysis error] ${mock.healthSummary}`;
        return NextResponse.json(mock);
      }
    }

  } catch (error) {
    console.error('Route error:', error);
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
      { priority: 'high',   title: 'Cash Runway Critical', description: 'Only 3.1 months of cash reserves. Immediately review debtor collections and consider short-term working capital financing.' },
      { priority: 'medium', title: 'Gross Margin Below Sector', description: 'Margin is 4pp below the sector benchmark. Review raw material costs and supplier contracts.' },
      { priority: 'low',    title: 'Revenue Growth Strong', description: '18% YoY growth is above sector average. Invest in sales capacity to sustain momentum.' },
    ],
    supportAreas: [
      { icon: '💰', label: 'Cash Flow Management',             level: 'urgent' },
      { icon: '📋', label: 'Debtor Management & Collections',  level: 'urgent' },
      { icon: '📊', label: 'Pricing & Margin Optimisation',    level: 'recommended' },
      { icon: '🏦', label: 'Working Capital Financing',        level: 'recommended' },
      { icon: '📈', label: 'Financial Reporting & Forecasting', level: 'recommended' },
      { icon: '🌱', label: 'Growth Strategy & Planning',       level: 'optional' },
    ],
    executiveSummary: `${businessName} is a ${stage.toLowerCase()} business in the ${sector} sector demonstrating strong commercial momentum with 18% year-on-year revenue growth.\n\nHowever, the business faces significant short-term financial pressure. Cash runway of only 3.1 months is a critical concern. The current ratio of 1.3× is below the healthy threshold of 2×.\n\nGross margins at 34% are 4 percentage points below the sector average of 38%, representing a meaningful opportunity to improve profitability.\n\nThe accelerator should prioritise connecting this business with mentors focused on cash flow management, debtor collections, and working capital solutions.`,
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
