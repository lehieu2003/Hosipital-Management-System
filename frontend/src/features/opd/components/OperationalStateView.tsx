import { AlertTriangle, Ban, CircleAlert, RefreshCw, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import type { OperationalFoundation, OperationalScreenId } from '../lib/foundations';

type OperationalStateViewProps = {
  description: string;
  foundation?: OperationalFoundation;
  isLoading: boolean;
  roleLabel: string;
  screenId: OperationalScreenId;
  title: string;
};

function statusIcon(status: OperationalFoundation['status']) {
  if (status === 'forbidden') {
    return Ban;
  }

  if (status === 'conflict') {
    return CircleAlert;
  }

  if (status === 'unavailable') {
    return AlertTriangle;
  }

  return ShieldCheck;
}

function statusTone(status: OperationalFoundation['status']) {
  if (status === 'forbidden') {
    return 'border-amber-200 bg-amber-50/70 text-amber-950';
  }

  if (status === 'conflict') {
    return 'border-rose-200 bg-rose-50/70 text-rose-950';
  }

  if (status === 'unavailable') {
    return 'border-slate-200 bg-slate-50/80 text-slate-950';
  }

  return 'border-emerald-200 bg-emerald-50/70 text-emerald-950';
}

export function OperationalStateView({
  description,
  foundation,
  isLoading,
  roleLabel,
  screenId,
  title,
}: OperationalStateViewProps) {
  return (
    <section className="space-y-5" data-testid={`${screenId}-page`}>
      <div className="dashboard-card p-8">
        <Badge className="brand-soft rounded-lg" variant="secondary">
          {roleLabel}
        </Badge>
        <h2 className="text-balance mt-5 text-3xl font-bold tracking-[-0.04em]">{title}</h2>
        <p className="text-pretty mt-3 max-w-3xl text-muted-foreground">{description}</p>
      </div>

      {isLoading ? (
        <Card className="dashboard-card border-border" data-testid={`${screenId}-loading-state`}>
          <CardHeader className="space-y-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
              <RefreshCw className="size-5 animate-spin" />
            </div>
            <div className="space-y-2">
              <CardTitle>Loading operational boundary</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                Requesting the current screen state before any operational data is rendered.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </CardContent>
        </Card>
      ) : foundation ? (
        <Card
          className={`dashboard-card ${statusTone(foundation.status)}`}
          data-screen-code={foundation.code}
          data-screen-status={foundation.status}
          data-testid={`${screenId}-${foundation.status}-state`}
        >
          <CardHeader className="space-y-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-white/80 shadow-sm">
              {(() => {
                const Icon = statusIcon(foundation.status);
                return <Icon className="size-5" />;
              })()}
            </div>
            <div className="space-y-2">
              <CardTitle>{foundation.title}</CardTitle>
              <p className="text-sm leading-6 opacity-90">{foundation.description}</p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-current/10 bg-white/70 p-5">
              <p className="text-sm font-semibold">Planned capabilities</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 opacity-90">
                {foundation.capabilities.map((capability) => (
                  <li key={capability}>• {capability}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-current/10 bg-white/70 p-5">
              <p className="text-sm font-semibold">Diagnostics</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 opacity-90">
                {foundation.diagnostics.map((diagnostic) => (
                  <li key={diagnostic}>• {diagnostic}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
