'use client';

import { useState } from 'react';
import UploadScreen from '@/components/UploadScreen';
import ProcessingScreen from '@/components/ProcessingScreen';
import DashboardScreen from '@/components/DashboardScreen';
import NavBar from '@/components/NavBar';
import StepBar from '@/components/StepBar';
import type { FinancialAnalysis } from '@/lib/analyzeFinancials';

type InputType = 'management' | 'bank';
type Step = 'choose' | 'upload' | 'processing' | 'dashboard';

export default function Home() {
  const [step, setStep] = useState<Step>('choose');
  const [inputType, setInputType] = useState<InputType>('management');
  const [analysis, setAnalysis] = useState<FinancialAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stepNumber = step === 'choose' ? 1 : step === 'upload' ? 2 : step === 'processing' ? 3 : 4;

  const handleChoose = (type: InputType) => {
    setInputType(type);
    setStep('upload');
  };

  const handleUploadComplete = async (formData: FormData) => {
    setStep('processing');
    setError(null);
    try {
      const files        = formData.getAll('files') as File[];
      const businessName = formData.get('businessName') as string;
      const sector       = formData.get('sector')       as string;
      const stage        = formData.get('stage')        as string;
      const yearEnd      = formData.get('yearEnd')      as string;
      const inputType    = formData.get('inputType')    as string;

      // ── Phase 1: extract each file individually (small requests, parallel) ──
      const extractions = await Promise.all(
        files.map(async (file) => {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('businessName', businessName);
          fd.append('inputType', inputType);
          const res = await fetch('/api/extract', { method: 'POST', body: fd });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || `Failed to extract ${file.name}`);
          }
          return res.json();
        })
      );

      // ── Phase 2: analyse the extracted text (no files, tiny JSON payload) ──
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, sector, stage, yearEnd, inputType, extractions }),
      });

      if (!analyzeRes.ok) {
        let errorMessage = `Analysis failed (${analyzeRes.status})`;
        try {
          const ct = analyzeRes.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const err = await analyzeRes.json();
            errorMessage = err.error || errorMessage;
          } else if (analyzeRes.status === 504 || analyzeRes.status === 502) {
            errorMessage = 'Analysis timed out. Please try again.';
          }
        } catch { /* keep default */ }
        throw new Error(errorMessage);
      }

      const result: FinancialAnalysis = await analyzeRes.json();
      setAnalysis(result);
      setStep('dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred');
      setStep('upload');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">
      <NavBar onNewAnalysis={() => { setStep('choose'); setAnalysis(null); setError(null); }} />
      <StepBar currentStep={stepNumber} />
      
      <main className="flex-1">
        {error && (
          <div className="max-w-3xl mx-auto mt-6 px-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
              ⚠️ {error}
            </div>
          </div>
        )}
        
        {step === 'choose' && (
          <ChooseScreen onChoose={handleChoose} />
        )}
        {step === 'upload' && (
          <UploadScreen inputType={inputType} onSubmit={handleUploadComplete} onBack={() => setStep('choose')} />
        )}
        {step === 'processing' && (
          <ProcessingScreen inputType={inputType} />
        )}
        {step === 'dashboard' && analysis && (
          <DashboardScreen
            analysis={analysis}
            onReanalyse={() => { setStep('choose'); setAnalysis(null); }}
          />
        )}
      </main>
    </div>
  );
}

function ChooseScreen({ onChoose }: { onChoose: (type: InputType) => void }) {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-brand-blue mb-2">What documents do you have?</h1>
        <p className="text-gray-500 text-base">Choose the type of financial documents you'll be uploading for this business.</p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <button
          onClick={() => onChoose('management')}
          className="text-left bg-white p-7 rounded-xl border-2 border-gray-200 transition-all hover:border-brand-blue hover:shadow-md cursor-pointer"
        >
          <div className="text-4xl mb-4">📊</div>
          <h3 className="font-bold text-brand-blue text-lg mb-2">Management Accounts</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-4">Income statements, balance sheet, and cash flow statements prepared by your accountant.</p>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-100 text-brand-blue">Most detailed analysis</span>
        </button>
        <button
          onClick={() => onChoose('bank')}
          className="text-left bg-white p-7 rounded-xl border-2 border-gray-200 transition-all hover:border-brand-blue hover:shadow-md cursor-pointer"
        >
          <div className="text-4xl mb-4">🏦</div>
          <h3 className="font-bold text-brand-blue text-lg mb-2">Bank Statements</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-4">12 months of business bank statements. We'll reconstruct your financials from transactions.</p>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-teal-100 text-teal-800">No accountant needed</span>
        </button>
      </div>
    </div>
  );
}
