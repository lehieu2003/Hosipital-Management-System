import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type QueueStateCardProps = {
  children?: ReactNode;
  code: string;
  description: string;
  diagnostics: string[];
  icon: ReactNode;
  status: string;
  testId: string;
  title: string;
  tone: string;
};

export function QueueStateCard({
  children,
  code,
  description,
  diagnostics,
  icon,
  status,
  testId,
  title,
  tone,
}: QueueStateCardProps) {
  return (
    <Card
      className={`dashboard-card rounded-[30px] ${tone}`}
      data-screen-code={code}
      data-screen-status={status}
      data-testid={testId}
    >
      <CardHeader className="space-y-4 pb-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-white/85 shadow-sm">
          {icon}
        </div>
        <div className="space-y-2">
          <CardTitle className="text-xl">{title}</CardTitle>
          <p className="text-sm leading-6 opacity-90">{description}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {children}
        <div className="rounded-3xl border border-current/10 bg-white/75 p-5">
          <p className="text-sm font-semibold">Diagnostics</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 opacity-90">
            {diagnostics.map((diagnostic) => (
              <li key={diagnostic}>• {diagnostic}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
