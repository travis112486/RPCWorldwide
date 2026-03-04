'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';

interface RangeSliderProps {
  id: string;
  label?: string;
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (range: [number, number]) => void;
  formatLabel?: (v: number) => string;
  className?: string;
}

export function RangeSlider({
  id,
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  formatLabel = String,
  className,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'min' | 'max' | null>(null);

  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  const valueFromX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return min;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      return Math.round(raw / step) * step;
    },
    [min, max, step],
  );

  const handlePointerDown = useCallback(
    (handle: 'min' | 'max') => (e: React.PointerEvent) => {
      e.preventDefault();
      setDragging(handle);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const v = valueFromX(e.clientX);
      if (dragging === 'min') {
        onChange([Math.min(v, value[1] - step), value[1]]);
      } else {
        onChange([value[0], Math.max(v, value[0] + step)]);
      }
    },
    [dragging, value, valueFromX, onChange, step],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  // Allow clicking on the track to jump
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      const v = valueFromX(e.clientX);
      const distToMin = Math.abs(v - value[0]);
      const distToMax = Math.abs(v - value[1]);
      if (distToMin <= distToMax) {
        onChange([Math.min(v, value[1] - step), value[1]]);
      } else {
        onChange([value[0], Math.max(v, value[0] + step)]);
      }
    },
    [valueFromX, value, onChange, step],
  );

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-8 text-right">{formatLabel(value[0])}</span>
        <div
          ref={trackRef}
          id={id}
          className="relative flex h-8 flex-1 touch-none items-center"
          onClick={handleTrackClick}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Track background */}
          <div className="absolute h-1.5 w-full rounded-full bg-muted" />
          {/* Active range */}
          <div
            className="absolute h-1.5 rounded-full bg-primary"
            style={{
              left: `${pct(value[0])}%`,
              width: `${pct(value[1]) - pct(value[0])}%`,
            }}
          />
          {/* Min handle */}
          <div
            className={cn(
              'absolute h-4.5 w-4.5 -translate-x-1/2 cursor-grab rounded-full border-2 border-primary bg-background shadow-sm',
              dragging === 'min' && 'cursor-grabbing ring-2 ring-ring',
            )}
            style={{ left: `${pct(value[0])}%` }}
            onPointerDown={handlePointerDown('min')}
            role="slider"
            aria-valuemin={min}
            aria-valuemax={value[1]}
            aria-valuenow={value[0]}
            tabIndex={0}
          />
          {/* Max handle */}
          <div
            className={cn(
              'absolute h-4.5 w-4.5 -translate-x-1/2 cursor-grab rounded-full border-2 border-primary bg-background shadow-sm',
              dragging === 'max' && 'cursor-grabbing ring-2 ring-ring',
            )}
            style={{ left: `${pct(value[1])}%` }}
            onPointerDown={handlePointerDown('max')}
            role="slider"
            aria-valuemin={value[0]}
            aria-valuemax={max}
            aria-valuenow={value[1]}
            tabIndex={0}
          />
        </div>
        <span className="text-xs text-muted-foreground w-8">{formatLabel(value[1])}</span>
      </div>
    </div>
  );
}
