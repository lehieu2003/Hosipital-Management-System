import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function FinalCtaSection() {
  return (
    <section className="mx-auto max-w-7xl pt-2">
      <Card className="dashboard-card overflow-hidden border-cyan-100/80 bg-slate-950 py-0 text-white">
        <CardContent className="grid gap-6 px-7 py-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10 lg:py-10">
          <div className="space-y-3">
            <Badge className="rounded-full border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white" variant="outline">
              Ready to enter the workspace?
            </Badge>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.04em] md:text-4xl">
              Built for admin setup, reception scheduling, and doctor queue flow in one clinical system.
            </h2>
            <p className="max-w-2xl text-base leading-7 text-slate-300">
              Start at sign-in, then move into the protected workspace that matches the user’s role and current operational responsibility.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <Button asChild className="h-12 rounded-xl bg-white px-6 text-cyan-900 hover:bg-cyan-50">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild className="h-12 rounded-xl border-white/12 bg-white/8 px-6 text-white hover:bg-white/14" variant="outline">
              <a href="#roles">Review roles</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
