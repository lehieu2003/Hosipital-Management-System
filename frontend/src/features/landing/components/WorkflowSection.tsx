import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { landingWorkflowSteps } from '../data';
import { SectionIntro } from './SectionIntro';

export function WorkflowSection() {
  return (
    <section className="mx-auto max-w-7xl space-y-5" id="workflow">
      <SectionIntro
        body="The product should explain itself in the same order the clinic experiences it: setup first, booking next, queue progression last."
        eyebrow="Workflow"
        title="A credible outpatient flow from setup to consultation."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {landingWorkflowSteps.map((step) => {
          const Icon = step.icon;

          return (
            <Card key={step.step} className="dashboard-card border-cyan-100/80 bg-white/95 py-0">
              <CardHeader className="space-y-4 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                    <Icon className="size-5" />
                  </div>
                  <span className="tabular text-sm font-semibold text-cyan-800">{step.step}</span>
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-xl tracking-[-0.03em]">{step.title}</CardTitle>
                  <CardDescription className="text-sm leading-6">{step.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
