'use client';

import { Button } from '@/components/ui/button';

interface WizardNavProps {
  step: number;
  totalSteps: number;
  loading?: boolean;
  onBack?: () => void;
  onNext: () => void;
  onSaveExit: () => void;
  nextLabel?: string;
}

export function WizardNav({
  step,
  totalSteps,
  loading,
  onBack,
  onNext,
  onSaveExit,
  nextLabel,
}: WizardNavProps) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
      <Button
        type="button"
        variant="ghost"
        onClick={onSaveExit}
        disabled={loading}
      >
        Save &amp; Exit
      </Button>

      <div className="flex gap-3">
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={loading}
          >
            Back
          </Button>
        )}
        <Button
          type="button"
          onClick={onNext}
          loading={loading}
        >
          {nextLabel ?? (step === totalSteps ? 'Complete Profile' : 'Next')}
        </Button>
      </div>
    </div>
  );
}
