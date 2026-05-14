import { CheckCircle2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { landingOverviewItems, landingPostureItems } from '../data';
import { SectionIntro } from './SectionIntro';

export function OverviewSection() {
  return (
    <section className="mx-auto max-w-7xl space-y-5" id="overview">
      <SectionIntro
        badgeVariant="secondary"
        body="The product starts with operational clarity: who can configure, who can schedule, and who owns queue progression. Every surface should keep status readable and failure behavior explicit."
        eyebrow="Overview"
        title="Built around the real outpatient handoff, not a generic dashboard shell."
      />

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="dashboard-card overflow-hidden border-cyan-100/80 bg-white/95 py-0">
          <CardHeader className="border-b border-border px-7 py-6">
            <CardTitle className="text-2xl tracking-[-0.04em]">Operational surfaces</CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7">
              Each role enters the same product language, but with a workspace shaped to the work in front of them.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 px-7 py-7 md:grid-cols-3">
            {landingOverviewItems.map((item) => (
              <div key={item.label} className="rounded-2xl border border-cyan-100 bg-cyan-50/50 p-5">
                <p className="text-sm font-semibold text-cyan-900">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="dashboard-card border-cyan-100/80 bg-white/95">
          <CardHeader className="space-y-3">
            <CardTitle className="text-2xl tracking-[-0.04em]">System posture</CardTitle>
            <CardDescription className="text-base leading-7">
              Trust comes from what the interface does when state is uncertain, degraded, or denied.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {landingPostureItems.map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-border bg-slate-50/70 p-4">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <p className="text-sm leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
