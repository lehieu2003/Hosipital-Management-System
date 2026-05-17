import { AlertTriangle, Ban, CircleAlert, RefreshCw, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import type { OperationalFoundation } from '../lib/foundations';

type OperationalStateViewProps = {
  description: string;
  foundation?: OperationalFoundation;
  isLoading: boolean;
  roleLabel: string;
  screenId: OperationalFoundation['screenId'];
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
    <section className="space-y-6" data-testid={`${screenId}-page`}>
      <div className="dashboard-card p-8 lg:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="brand-soft rounded-full px-3 py-1" variant="secondary">
            {roleLabel} workspace
          </Badge>
          {foundation ? (
            <Badge className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700" variant="outline">
              {foundation.code}
            </Badge>
          ) : null}
        </div>
        <div className="mt-6 max-w-4xl space-y-3">
          <h2 className="text-balance text-3xl font-bold tracking-[-0.04em] text-slate-950">{title}</h2>
          <p className="text-pretty text-base leading-7 text-slate-600">{description}</p>
        </div>
      </div>

      {isLoading ? (
        <Card className="dashboard-card rounded-[30px] border-border" data-testid={`${screenId}-loading-state`}>
          <CardHeader className="space-y-4 pb-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 shadow-sm">
              <RefreshCw className="size-5 animate-spin" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-xl">Loading operational boundary</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                Requesting the current screen state before any operational data is rendered.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-1/2 rounded-full" />
            <Skeleton className="h-4 w-full rounded-full" />
            <Skeleton className="h-4 w-5/6 rounded-full" />
          </CardContent>
        </Card>
      ) : foundation ? (
        <Card
          className={`dashboard-card rounded-[30px] ${statusTone(foundation.status)}`}
          data-screen-code={foundation.code}
          data-screen-status={foundation.status}
          data-testid={`${screenId}-${foundation.status}-state`}
        >
          <CardHeader className="space-y-4 pb-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/85 shadow-sm">
              {(() => {
                const Icon = statusIcon(foundation.status);
                return <Icon className="size-5" />;
              })()}
            </div>
            <div className="space-y-2">
              <CardTitle className="text-xl">{foundation.title}</CardTitle>
              <p className="text-sm leading-6 opacity-90">{foundation.description}</p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-3xl border border-current/10 bg-white/75 p-5">
              <p className="text-sm font-semibold">Planned capabilities</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 opacity-90">
                {foundation.capabilities.map((capability) => (
                  <li key={capability}>• {capability}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-current/10 bg-white/75 p-5">
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
