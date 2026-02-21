'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { FinancialAnalysis } from '@/lib/analyzeFinancials';

interface Props {
  analysis: FinancialAnalysis;
  onReanalyse: () => void;
}

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return 'R0';
  if (value >= 1000000) return `R${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R${(value / 1000).toFixed(0)}K`;
  return `R${value}`;
};

const scoreColor = (score: number) => {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#00A99D';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
};

export default function DashboardScreen({ analysis, onReanalyse }: Props) {
  const handleDownloadPDF = () => {
    window.print();
  };

  const scorePercent = analysis.healthScore;
  const color = scoreColor(scorePercent);
  const conicGradient = `conic-gradient(${color} 0% ${scorePercent}%, #E5E7EB ${scorePercent}% 100%)`;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 pb-28">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue">{analysis.businessName} — Financial Health Report</h1>
          <p className="text-gray-500 text-sm mt-1">{analysis.period} · Analysed {new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex gap-3 flex-wrap no-print">
          <button onClick={onReanalyse} className="border-2 border-brand-blue text-brand-blue text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
            ↺ Re-analyse
          </button>
          <button
            onClick={handleDownloadPDF}
            className="bg-brand-orange text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            ⬇ Download PDF Report
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start mb-6 text-sm text-brand-blue">
        <span className="text-lg">ℹ️</span>
        <span>{analysis.healthSummary}</span>
      </div>

      {/* Score + KPIs */}
      <div className="grid grid-cols-[220px_1fr] gap-5 mb-5">
        {/* Health score */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Overall Health Score</div>
          <div
            className="w-[120px] h-[120px] rounded-full flex items-center justify-center mb-3"
            style={{ background: conicGradient }}
          >
            <div className="w-[88px] h-[88px] bg-white rounded-full flex flex-col items-center justify-center">
              <span className="text-[1.9rem] font-black text-brand-blue leading-none">{analysis.healthScore}</span>
              <span className="text-xs text-gray-400">/100</span>
            </div>
          </div>
          <div className="font-bold text-base" style={{ color }}>{analysis.healthGrade}</div>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-[180px]">
            {analysis.healthScore >= 80 ? 'Strong financial health.' :
             analysis.healthScore >= 60 ? 'Viable but needs attention in some areas.' :
             analysis.healthScore >= 40 ? 'Significant financial pressures require intervention.' :
             'Critical — immediate support needed.'}
          </p>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Annual Revenue', value: analysis.kpis.revenue, change: analysis.kpis.revenueChange, positive: analysis.kpis.revenueChangePositive },
            { label: 'Gross Profit Margin', value: analysis.kpis.grossMargin, change: analysis.kpis.grossMarginVsSector, positive: analysis.kpis.grossMarginPositive },
            { label: 'Net Profit Margin', value: analysis.kpis.netMargin, change: analysis.kpis.netMarginVsSector, positive: analysis.kpis.netMarginPositive },
            { label: 'Current Ratio', value: analysis.kpis.currentRatio, change: analysis.kpis.currentRatioNote, positive: analysis.kpis.currentRatioPositive },
            { label: 'Cash Runway', value: analysis.kpis.cashRunway, change: analysis.kpis.cashRunwayNote, positive: analysis.kpis.cashRunwayPositive },
            { label: 'Debt-to-Equity', value: analysis.kpis.debtToEquity, change: analysis.kpis.debtToEquityNote, positive: analysis.kpis.debtToEquityPositive },
          ].map((kpi, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-[0.7rem] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{kpi.label}</div>
              <div className="text-2xl font-black text-brand-blue">{kpi.value}</div>
              <div className={`text-xs font-semibold mt-1 ${kpi.positive ? 'text-green-600' : 'text-red-500'}`}>
                {kpi.change}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart + Recommendations */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Revenue chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-sm font-bold text-brand-blue mb-4 flex items-center gap-2">📊 Monthly Revenue vs Expenses</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analysis.monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={formatCurrency as any} tick={{ fontSize: 10 }} width={55} />
              <Tooltip formatter={formatCurrency as any} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="#93C5FD" radius={[3,3,0,0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#FCA5A5" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recommendations */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-sm font-bold text-brand-blue mb-4 flex items-center gap-2">⚡ Key Findings & Recommendations</div>
          <div className="flex flex-col gap-3">
            {analysis.recommendations.map((rec, i) => {
              const colors = {
                high: { bg: 'bg-red-50', dot: 'bg-red-500', title: 'text-red-700', icon: '🔴' },
                medium: { bg: 'bg-amber-50', dot: 'bg-amber-400', title: 'text-amber-700', icon: '🟡' },
                low: { bg: 'bg-green-50', dot: 'bg-green-500', title: 'text-green-700', icon: '🟢' },
              };
              const c = colors[rec.priority];
              return (
                <div key={i} className={`flex gap-3 p-3 rounded-lg ${c.bg}`}>
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${c.dot}`} />
                  <div>
                    <div className={`text-xs font-bold mb-0.5 ${c.title}`}>
                      {c.icon} {rec.priority === 'high' ? 'Critical' : rec.priority === 'medium' ? 'Attention' : 'Positive'} — {rec.title}
                    </div>
                    <div className="text-xs text-gray-700 leading-relaxed">{rec.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Support areas */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <div className="text-sm font-bold text-brand-blue mb-4">🤝 Recommended Accelerator Support Areas</div>
        <div className="grid grid-cols-2 gap-3">
          {analysis.supportAreas.map((area, i) => {
            const levelStyles = {
              urgent: { badge: 'bg-red-100 text-red-800', label: 'Urgent' },
              recommended: { badge: 'bg-amber-100 text-amber-800', label: 'Recommended' },
              optional: { badge: 'bg-green-100 text-green-800', label: 'Optional' },
            };
            const ls = levelStyles[area.level];
            return (
              <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
                <span className="text-xl">{area.icon}</span>
                <span className="text-sm font-semibold flex-1">{area.label}</span>
                <span className={`text-[0.7rem] font-bold px-2.5 py-0.5 rounded-full ${ls.badge}`}>{ls.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Executive summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <div className="text-sm font-bold text-brand-blue mb-4">📝 Executive Summary</div>
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{analysis.executiveSummary}</div>
      </div>

      {/* Strengths & Risks */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="text-sm font-bold text-green-800 mb-3">✅ Key Strengths</div>
          <ul className="flex flex-col gap-2">
            {analysis.keyStrengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-green-800">
                <span className="text-green-500 mt-0.5">•</span> {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="text-sm font-bold text-red-800 mb-3">⚠️ Key Risks</div>
          <ul className="flex flex-col gap-2">
            {analysis.keyRisks.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-red-800">
                <span className="text-red-400 mt-0.5">•</span> {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-10 py-4 flex justify-end gap-3 no-print" style={{ boxShadow: '0 -4px 12px rgba(0,0,0,0.06)' }}>
        <button onClick={onReanalyse} className="border-2 border-brand-blue text-brand-blue text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
          ↺ Upload New Documents
        </button>
        <button className="bg-brand-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 flex items-center gap-2">
          📤 Share with Advisor
        </button>
        <button
          onClick={handleDownloadPDF}
          className="bg-brand-orange text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 flex items-center gap-2"
        >
          ⬇ Download Full PDF Report
        </button>
      </div>
    </div>
  );
}
