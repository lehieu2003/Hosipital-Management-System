import { Activity, ArrowRight, RefreshCw, ShieldBan, Timer, UserRoundCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const queueRows = [
  { patient: 'Linh Nguyen', priority: 'Urgent', room: 'ER-02', status: 'Waiting', time: '04m' },
  { patient: 'Duc Hoang', priority: 'Normal', room: 'A-11', status: 'In triage', time: '18m' },
  { patient: 'Mai Pham', priority: 'Normal', room: 'B-07', status: 'Ready', time: '25m' },
  { patient: 'An Vo', priority: 'Follow-up', room: 'C-04', status: 'Queued', time: '31m' },
];

const queueStats = [
  { icon: Activity, label: 'Live queue', value: '42' },
  { icon: Timer, label: 'Avg wait', value: '18m' },
  { icon: UserRoundCheck, label: 'Completed', value: '128' },
];

export function QueuePage() {
  return (
    <section className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.35fr_repeat(3,minmax(0,0.6fr))]">
        <div className="dashboard-card p-8">
          <Badge className="brand-soft rounded-lg" variant="secondary">
            Doctor
          </Badge>
          <h2 className="text-balance mt-5 text-3xl font-bold tracking-[-0.04em]">Queue workspace</h2>
          <p className="text-pretty mt-3 max-w-2xl text-muted-foreground">
            Queue polling and appointment progression are shaped for live patient cards, refresh
            recovery, and consultation actions once endpoints are available.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button className="brand-button h-11 rounded-lg px-5">
              <RefreshCw className="size-4" />
              Refresh queue
            </Button>
            <Button className="h-11 rounded-lg bg-white text-cyan-800 hover:bg-cyan-50" variant="outline">
              View diagnostics
            </Button>
          </div>
        </div>

        {queueStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div key={stat.label} className="dashboard-card flex min-h-[210px] flex-col justify-between p-7">
              <div className="flex size-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-muted-foreground">{stat.label}</p>
                <p className="tabular mt-3 text-4xl font-bold tracking-[-0.05em]">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.38fr]">
        <div className="dashboard-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-6">
            <div>
              <h2 className="text-xl font-bold tracking-[-0.03em]">Consultation Queue</h2>
              <p className="mt-1 text-sm text-muted-foreground">Prepared for live patient rows</p>
            </div>
            <Badge className="success-pill rounded-full" variant="outline">
              Online
            </Badge>
          </div>

          <div className="divide-y divide-border">
            {queueRows.map((row) => (
              <div key={row.patient} className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_120px_120px_120px_90px] md:items-center">
                <div>
                  <p className="font-semibold">{row.patient}</p>
                  <p className="text-sm text-muted-foreground">{row.room}</p>
                </div>
                <Badge
                  className={
                    row.priority === 'Urgent'
                      ? 'rounded-lg border-red-200 bg-red-50 text-red-700'
                      : 'rounded-lg'
                  }
                  variant={row.priority === 'Urgent' ? 'outline' : 'secondary'}
                >
                  {row.priority}
                </Badge>
                <p className="text-sm text-muted-foreground">{row.status}</p>
                <p className="tabular text-sm font-semibold">{row.time}</p>
                <button className="flex items-center gap-2 text-sm font-semibold md:justify-end">
                  Open
                  <ArrowRight className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-card p-6">
          <div className="flex size-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <ShieldBan className="size-5" />
          </div>
          <h2 className="mt-5 text-xl font-bold tracking-[-0.03em]">Fail closed</h2>
          <p className="text-pretty mt-3 leading-7 text-muted-foreground">
            Refresh on interval and focus, replay once after token refresh, then surface unavailable
            state instead of implying safe access.
          </p>
        </div>
      </div>
    </section>
  );
}
