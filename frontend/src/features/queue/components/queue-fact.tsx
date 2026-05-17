import { cn } from '@/lib/utils';

type QueueFactProps = {
  label: string;
  value: string;
  valueTestId?: string;
  variant?: 'default' | 'mono';
};

export function QueueFact({ label, value, valueTestId, variant = 'default' }: QueueFactProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/65 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-2 text-sm leading-6 text-slate-950 [font-variant-numeric:tabular-nums]',
          variant === 'mono' && 'break-all font-mono text-[13px] leading-5 text-slate-700',
          variant === 'default' && 'text-pretty',
        )}
        data-testid={valueTestId}
      >
        {value}
      </dd>
    </div>
  );
}
