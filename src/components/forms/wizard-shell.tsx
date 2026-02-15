'use client';

import { cn } from '@/lib/utils/cn';
import { WIZARD_STEPS } from '@/constants/profile';

interface WizardShellProps {
  currentStep: number;
  children: React.ReactNode;
}

export function WizardShell({ currentStep, children }: WizardShellProps) {
  const progressPct = (currentStep / WIZARD_STEPS.length) * 100;

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between text-sm font-medium text-muted-foreground">
          <span>Step {currentStep} of {WIZARD_STEPS.length}</span>
          <span>{Math.round(progressPct)}% complete</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-brand-secondary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="mb-8 hidden sm:flex sm:items-center sm:justify-between">
        {WIZARD_STEPS.map((step) => (
          <div key={step.number} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                step.number < currentStep && 'bg-brand-secondary text-white',
                step.number === currentStep && 'bg-brand-primary text-white',
                step.number > currentStep && 'bg-muted text-muted-foreground',
              )}
            >
              {step.number < currentStep ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.number
              )}
            </div>
            <span
              className={cn(
                'hidden text-sm font-medium lg:inline',
                step.number === currentStep ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {step.title}
            </span>
            {step.number < WIZARD_STEPS.length && (
              <div className="mx-2 hidden h-px w-8 bg-border xl:block" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {children}
    </div>
  );
}
