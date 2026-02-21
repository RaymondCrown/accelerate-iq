'use client';

const steps = [
  { n: 1, label: 'Choose Input' },
  { n: 2, label: 'Upload Documents' },
  { n: 3, label: 'Analyse' },
  { n: 4, label: 'Report & Insights' },
];

export default function StepBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="bg-white border-b border-gray-200 flex justify-center">
      <div className="flex items-center">
        {steps.map((step, i) => (
          <div key={step.n} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold border-b-[3px] transition-all select-none ${
                currentStep === step.n
                  ? 'text-brand-blue border-brand-blue'
                  : currentStep > step.n
                  ? 'text-brand-teal border-transparent'
                  : 'text-gray-400 border-transparent'
              }`}
            >
              <div
                className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs font-bold ${
                  currentStep > step.n
                    ? 'bg-brand-teal text-white'
                    : currentStep === step.n
                    ? 'bg-brand-blue text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {currentStep > step.n ? '✓' : step.n}
              </div>
              {step.label}
            </div>
            {i < steps.length - 1 && (
              <span className="text-gray-300 text-lg px-1">›</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
