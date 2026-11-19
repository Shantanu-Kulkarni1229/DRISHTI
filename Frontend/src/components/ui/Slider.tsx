import { cn } from '../../lib/utils';

interface Props {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  leftLabel?: string;
  rightLabel?: string;
  className?: string;
  accent?: string;
  disabled?: boolean;
}

export function Slider({ value, min = 0, max = 1, step = 0.01, onChange, leftLabel, rightLabel, className, accent, disabled }: Props) {
  const pct = ((value - min) / (max - min)) * 100;
  const color = accent ?? 'var(--color-accent)';
  return (
    <div className={cn('w-full', className)}>
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between text-[11px] text-text-muted mb-1.5">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-accent [&::-moz-range-thumb]:cursor-pointer"
        style={{ background: `linear-gradient(to right, ${color} ${pct}%, var(--color-border) ${pct}%)` }}
      />
    </div>
  );
}
