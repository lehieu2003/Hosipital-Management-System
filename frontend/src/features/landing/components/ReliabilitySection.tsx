import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { landingTrustCards } from '../data';
import { SectionIntro } from './SectionIntro';

export function ReliabilitySection() {
  return (
    <section className="mx-auto max-w-7xl space-y-5" id="reliability">
      <SectionIntro
        body="The interface earns trust by making limits, failure paths, and recovery behavior visible in operational terms."
        eyebrow="Reliability"
        title="Hospital-facing trust comes from behavior, not slogans."
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {landingTrustCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.title} className="dashboard-card border-cyan-100/80 bg-white/95">
              <CardHeader className="space-y-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Icon className="size-5" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-xl tracking-[-0.03em]">{card.title}</CardTitle>
                  <CardDescription className="text-sm leading-6">{card.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
