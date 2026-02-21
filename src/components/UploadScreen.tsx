'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { AVAILABLE_MODELS, type ModelId } from '@/lib/analyzeFinancials';

const SECTORS = [
  'Food & Beverage', 'Retail', 'Technology', 'Manufacturing',
  'Professional Services', 'Healthcare', 'Construction', 'Agriculture', 'Other',
];

const STAGES = [
  'Pre-revenue (0–1 years)', 'Early Stage (1–2 years)',
  'Growth Stage (2–5 years)', 'Mature (5+ years)',
];

interface Props {
  inputType: 'management' | 'bank';
  onSubmit: (fd: FormData) => void;
  onBack: () => void;
}

export default function UploadScreen({ inputType, onSubmit, onBack }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [sector, setSector] = useState(SECTORS[0]);
  const [stage, setStage] = useState(STAGES[2]);
  const [yearEnd, setYearEnd] = useState('February 2025');
  const [model, setModel] = useState<ModelId>(AVAILABLE_MODELS[0].id);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(prev => [...prev, ...accepted]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    multiple: true,
  });

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (files.length === 0) return;
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    fd.append('businessName', businessName || 'Unnamed Business');
    fd.append('sector', sector);
    fd.append('stage', stage);
    fd.append('yearEnd', yearEnd);
    fd.append('inputType', inputType);
    fd.append('model', model);
    onSubmit(fd);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-brand-blue mb-2">
          Upload {inputType === 'management' ? 'Management Accounts' : 'Bank Statements'}
        </h1>
        <p className="text-gray-500">
          Add all documents related to this business's financial year. Multiple files are supported.
        </p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`bg-white border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all mb-6 ${
          isDragActive ? 'border-brand-teal bg-teal-50' : 'border-gray-300 hover:border-brand-teal'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-4xl mb-3">⬆️</div>
        <h3 className="font-semibold text-brand-blue text-lg mb-1">
          {isDragActive ? 'Drop files here…' : 'Drag & drop your files here, or click to browse'}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {inputType === 'management'
            ? 'Management accounts, schedules, notes to accounts'
            : '12 months of business bank statements'}
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          {['PDF', 'XLSX', 'XLS', 'CSV', 'DOCX'].map(t => (
            <span key={t} className="bg-gray-100 border border-gray-200 rounded-md px-2.5 py-1 text-xs font-semibold text-gray-500">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Uploaded files */}
      {files.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <div className="text-sm font-bold text-brand-blue mb-3">📎 Uploaded Files</div>
          <div className="flex flex-col gap-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
                <span className="text-lg">{f.name.endsWith('.pdf') ? '📄' : '📊'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{f.name}</div>
                  <div className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</div>
                </div>
                <span className="text-green-600 font-bold text-xs">✓ Ready</span>
                <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Business context */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
        <div className="text-sm font-bold text-brand-blue mb-4">
          🏢 Business Context <span className="text-gray-400 font-normal">(optional — improves analysis accuracy)</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="e.g. Acme Bakery (Pty) Ltd"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-blue"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Industry Sector</label>
            <select
              value={sector}
              onChange={e => setSector(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-blue"
            >
              {SECTORS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Financial Year End</label>
            <input
              type="text"
              value={yearEnd}
              onChange={e => setYearEnd(e.target.value)}
              placeholder="e.g. February 2025"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-blue"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Stage of Business</label>
            <select
              value={stage}
              onChange={e => setStage(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-brand-blue"
            >
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* AI Model selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
        <div className="text-sm font-bold text-brand-blue mb-4">
          🤖 Analysis Model
        </div>
        <div className="grid grid-cols-3 gap-3">
          {AVAILABLE_MODELS.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModel(m.id)}
              className={`text-left p-4 rounded-lg border-2 transition-all ${
                model === m.id
                  ? 'border-brand-blue bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`text-sm font-semibold ${model === m.id ? 'text-brand-blue' : 'text-gray-700'}`}>{m.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{m.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="border-2 border-brand-blue text-brand-blue px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={files.length === 0}
          className={`px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all ${
            files.length > 0
              ? 'bg-brand-blue text-white hover:opacity-90 cursor-pointer'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Analyse Documents →
        </button>
      </div>
    </div>
  );
}
