'use client';

import { useEffect, useState } from 'react';

const managementTasks = [
  { icon: '📥', label: 'Extracting data from uploaded documents' },
  { icon: '🔍', label: 'Parsing income statement & balance sheet' },
  { icon: '📈', label: 'Calculating key financial ratios' },
  { icon: '🏭', label: 'Benchmarking against sector data' },
  { icon: '💡', label: 'Generating recommendations & support areas' },
  { icon: '📄', label: 'Preparing downloadable PDF report' },
];

const bankTasks = [
  { icon: '📥', label: 'Extracting transactions from bank statements' },
  { icon: '🏷️', label: 'Categorising income, expenses & transfers' },
  { icon: '📊', label: 'Building income statement from transactions' },
  { icon: '💵', label: 'Constructing cash flow & balance sheet' },
  { icon: '📈', label: 'Calculating key financial ratios' },
  { icon: '🏭', label: 'Benchmarking against sector data' },
  { icon: '💡', label: 'Generating recommendations & support areas' },
  { icon: '📄', label: 'Preparing downloadable PDF report' },
];

interface Props {
  inputType?: 'management' | 'bank';
}

export default function ProcessingScreen({ inputType = 'management' }: Props) {
  const [activeTask, setActiveTask] = useState(0);
  const tasks = inputType === 'bank' ? bankTasks : managementTasks;
  // Bank statements take longer — ~5s per step; management accounts ~3.5s
  const interval = inputType === 'bank' ? 5000 : 3500;

  useEffect(() => {
    setActiveTask(0);
    const timer = setInterval(() => {
      setActiveTask(prev => (prev < tasks.length - 1 ? prev + 1 : prev));
    }, interval);
    return () => clearInterval(timer);
  }, [inputType]);

  const isBank = inputType === 'bank';

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 text-center">
      <h1 className="text-3xl font-bold text-brand-blue mb-2">
        {isBank ? 'Converting & Analysing…' : 'Analysing your documents…'}
      </h1>
      <p className="text-gray-500 mb-2">
        {isBank
          ? 'Converting your bank statements into management accounts, then running the financial analysis.'
          : 'Our AI is reading your financial statements and generating insights.'}
      </p>
      {isBank && (
        <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5 mb-6 text-xs font-semibold text-teal-700">
          🔄 Two-stage process — this takes about 60 seconds
        </div>
      )}
      {!isBank && <div className="mb-8" />}

      <div className="flex justify-center mb-8">
        <div
          className="w-16 h-16 rounded-full border-[5px] border-gray-200 border-t-brand-teal"
          style={{ animation: 'spin 1s linear infinite' }}
        />
      </div>

      {/* Stage labels for bank statements */}
      {isBank && (
        <div className="flex gap-3 mb-4">
          <div className={`flex-1 rounded-lg p-2.5 text-xs font-semibold border ${activeTask < 4 ? 'bg-brand-blue text-white border-brand-blue' : 'bg-green-50 text-green-700 border-green-200'}`}>
            {activeTask < 4 ? '⚙️ Stage 1 — Converting' : '✓ Stage 1 — Converted'}
            <div className="font-normal mt-0.5 opacity-80">Bank statements → Management accounts</div>
          </div>
          <div className={`flex-1 rounded-lg p-2.5 text-xs font-semibold border ${activeTask < 4 ? 'bg-gray-50 text-gray-400 border-gray-200' : activeTask < tasks.length - 1 ? 'bg-brand-blue text-white border-brand-blue' : 'bg-green-50 text-green-700 border-green-200'}`}>
            {activeTask < 4 ? '⏳ Stage 2 — Pending' : '⚙️ Stage 2 — Analysing'}
            <div className="font-normal mt-0.5 opacity-80">Financial health analysis</div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden text-left">
        {tasks.map((task, i) => (
          <div key={i} className={`flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 last:border-b-0 transition-opacity ${i <= activeTask ? 'opacity-100' : 'opacity-35'}`}>
            <span className="text-lg w-7 text-center">{task.icon}</span>
            <span className="flex-1 text-sm">{task.label}</span>
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full ${
                i < activeTask
                  ? 'bg-green-100 text-green-800'
                  : i === activeTask
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {i < activeTask ? 'Done' : i === activeTask ? (isBank && i < 4 ? 'Converting…' : 'Analysing…') : 'Pending'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
