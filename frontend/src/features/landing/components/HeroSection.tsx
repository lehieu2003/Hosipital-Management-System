import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { resolveHomePath, useAuth } from '@/features/auth';

import { landingHeroHighlights, landingHeroMetrics, landingSurfacePreview } from '../data';

export function HeroSection() {
  const { session } = useAuth();
  const primaryHref = session ? resolveHomePath(session.role) : '/login';
  const primaryLabel = session ? 'Open workspace' : 'Sign in';

  return (
    <section className="relative overflow-hidden px-4 pt-10 pb-8 sm:px-6 lg:px-8 lg:pt-16 lg:pb-10">
      <div className="mx-auto grid max-w-7xl gap-10 xl:grid-cols-[1.04fr_minmax(0,0.96fr)] xl:items-center">
        <div className="space-y-8 lg:space-y-10">
          <div className="space-y-5">
            <Badge className="brand-soft rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase" variant="secondary">
              OPD-first hospital operations
            </Badge>
            <div className="max-w-3xl space-y-5">
              <h1 className="text-balance text-5xl font-semibold tracking-[-0.065em] text-slate-950 md:text-6xl xl:text-[4.45rem] xl:leading-[0.96]">
                From registration to queue flow, in one calm clinical workspace.
              </h1>
              <p className="text-pretty max-w-2xl text-lg leading-8 text-muted-foreground md:text-[1.2rem]">
                A role-safe operational surface for admin setup, front-desk scheduling, and doctor queue
                progression — with trustworthy status signals and fail-closed session behavior.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="brand-button h-12 rounded-xl px-6 text-sm font-semibold shadow-sm">
              <Link to={primaryHref}>
                {primaryLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild className="h-12 rounded-xl bg-white px-6 text-cyan-800 hover:bg-cyan-50" variant="outline">
              <a href="#overview">Explore workflow</a>
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {landingHeroMetrics.map((item) => (
              <div key={item.label} className="rounded-2xl border border-cyan-100/80 bg-white/92 px-4 py-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800/80">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {landingHeroHighlights.map((item) => (
              <div key={item} className="rounded-2xl border border-cyan-100/80 bg-white/82 px-4 py-4 shadow-sm backdrop-blur-sm">
                <p className="text-sm leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative xl:pl-4">
          <div className="absolute inset-x-10 top-2 h-36 rounded-full bg-cyan-200/35 blur-3xl" />
          <div className="absolute right-6 bottom-6 h-36 w-36 rounded-full bg-emerald-200/35 blur-3xl" />
          <div className="relative rounded-[2rem] border border-cyan-100/80 bg-white/90 p-4 shadow-[0_22px_70px_rgb(8_145_178/0.12)] backdrop-blur">
            <div className="overflow-hidden rounded-[1.4rem] border border-border bg-slate-950 text-white">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold tracking-wide text-cyan-100">Clinical workspace</p>
                  <p className="text-xs text-slate-400">Role-specific operational surfaces</p>
                </div>
                <Badge className="rounded-full border-white/10 bg-white/10 text-white" variant="outline">
                  Preview
                </Badge>
              </div>

              <div className="grid gap-4 p-5 lg:grid-cols-[0.94fr_1.06fr]">
                <div className="space-y-4 rounded-[1.2rem] border border-white/8 bg-white/6 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-200">Navigation</p>
                    <span className="text-xs text-emerald-300">Role aware</span>
                  </div>
                  <div className="space-y-2">
                    {['Admin overview', 'Scheduling', 'Doctor queue'].map((item, index) => (
                      <div
                        key={item}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-sm',
                          index === 1
                            ? 'border-cyan-400/40 bg-cyan-400/12 text-white'
                            : 'border-white/8 bg-white/4 text-slate-300',
                        )}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {landingSurfacePreview.map((item) => (
                    <div key={item.label} className="rounded-[1.2rem] border border-white/8 bg-white/6 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={cn('size-2.5 rounded-full', item.accent)} />
                          <p className="font-medium text-slate-100">{item.label}</p>
                        </div>
                        <span className="rounded-full border border-white/8 bg-white/8 px-2 py-1 text-[11px] text-slate-300">
                          Prepared
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{item.meta}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 border-t border-white/10 px-5 py-4 sm:grid-cols-3">
                {['Role-safe access', 'Conflict-aware updates', 'Visible recovery state'].map((item) => (
                  <div key={item} className="rounded-xl border border-white/8 bg-white/5 px-3 py-3 text-xs text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
