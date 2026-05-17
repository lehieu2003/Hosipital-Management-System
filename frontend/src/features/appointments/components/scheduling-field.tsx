import type { ReactNode } from 'react';

type SchedulingFieldProps = {
  children: ReactNode;
  htmlFor: string;
  label: string;
};

export function SchedulingField({ children, htmlFor, label }: SchedulingFieldProps) {
  return (
    <div className="space-y-2.5">
      <label className="text-sm font-medium text-slate-800" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}
