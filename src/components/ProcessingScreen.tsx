'use client';

import { useEffect, useState } from 'react';

const tasks = [
  { icon: '📥', label: 'Extracting data from uploaded documents' },
  { icon: '🔍', label: 'Parsing income statement & balance sheet' },
  { icon: '📈', label: 'Calculating key financial ratios' },
  { icon: '🏭', label: 'Benchmarking against sector data' },
  { icon: '💡', label: 'Generating recommendations & support areas' },
  { icon: '📄', label: 'Preparing downloadable PDF report' },
];

export default function ProcessingScreen() {
  const [activeTask, setActiveTask] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTask(prev => (prev < tasks.length - 1 ? prev + 1 : prev));
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 text-center">
      <h1 className="text-3xl font-bold text-brand-blue mb-2">Analysing your documents…</h1>
      <p className="text-gray-500 mb-8">Our AI is reading your financial statements and generating insights. This takes about 30 seconds.</p>

      <div className="flex justify-center mb-8">
        <div
          className="w-16 h-16 rounded-full border-[5px] border-gray-200 border-t-brand-teal"
          style={{ animation: 'spin 1s linear infinite' }}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden text-left">
        {tasks.map((task, i) => (
          <div key={i} className={`flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 last:border-b-0 ${i <= activeTask ? '' : 'opacity-40'}`}>
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
              {i < activeTask ? 'Done' : i === activeTask ? 'Analysing…' : 'Pending'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
