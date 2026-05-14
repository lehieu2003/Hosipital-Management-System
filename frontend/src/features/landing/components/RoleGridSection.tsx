import { CheckCircle2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { landingRoleCards } from '../data';
import { SectionIntro } from './SectionIntro';

export function RoleGridSection() {
  return (
    <section className="mx-auto max-w-7xl space-y-5" id="roles">
      <SectionIntro
        body="Navigation stays structurally consistent across the system. What changes is only what each role is allowed to see, configure, or progress."
        eyebrow="Role surfaces"
        title="One product language, three operational responsibilities."
      />

      <div className="grid gap-5 xl:grid-cols-3">
        {landingRoleCards.map((role) => {
          const Icon = role.icon;

          return (
            <Card key={role.label} className="dashboard-card border-cyan-100/80 bg-white/95 transition-transform duration-200 hover:-translate-y-0.5">
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className={cn('flex size-12 items-center justify-center rounded-2xl', role.tone)}>
                    <Icon className="size-5" />
                  </div>
                  <Badge className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]" variant="outline">
                    {role.label}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-2xl tracking-[-0.04em]">{role.label} workspace</CardTitle>
                  <CardDescription className="text-base leading-7">{role.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {role.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3 text-sm leading-6 text-slate-700">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-cyan-700" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
