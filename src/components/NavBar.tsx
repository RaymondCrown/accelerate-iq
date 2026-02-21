'use client';

export default function NavBar({ onNewAnalysis }: { onNewAnalysis: () => void }) {
  return (
    <nav className="bg-brand-blue px-10 py-3.5 flex items-center justify-between" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
      <div className="text-white font-bold text-xl tracking-tight">
        Accelerate<span className="text-brand-teal">IQ</span>
      </div>
      <div className="flex items-center gap-6">
        <a href="#" className="text-white/70 text-sm hover:text-white transition-colors">Dashboard</a>
        <a href="#" className="text-white/70 text-sm hover:text-white transition-colors">My Businesses</a>
        <button
          onClick={onNewAnalysis}
          className="bg-brand-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          + New Analysis
        </button>
      </div>
    </nav>
  );
}
