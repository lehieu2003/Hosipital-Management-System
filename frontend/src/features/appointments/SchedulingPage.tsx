import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Plus,
  ShieldAlert,
  Stethoscope,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const appointmentStats = [
  { change: '+12.4%', label: 'Bookings', value: '1,284' },
  { change: '+8.1%', label: 'Available slots', value: '312' },
  { change: '-2.6%', label: 'No-show rate', value: '4.8%' },
];

const scheduleRows = [
  { doctor: 'Dr. Avery Chen', room: 'Room A12', time: '08:30', type: 'Cardiology' },
  { doctor: 'Dr. Minh Tran', room: 'Room B04', time: '09:15', type: 'Pediatrics' },
  { doctor: 'Dr. Leah Pham', room: 'Room C02', time: '10:00', type: 'Neurology' },
  { doctor: 'Dr. Omar Malik', room: 'Room A08', time: '10:45', type: 'General' },
];

export function SchedulingPage() {
  return (
    <section className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="dashboard-card overflow-hidden p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <Badge className="brand-soft rounded-lg" variant="secondary">
                Receptionist
              </Badge>
              <div>
                <h2 className="text-balance text-3xl font-bold tracking-[-0.04em]">
                  Scheduling workspace
                </h2>
                <p className="text-pretty mt-3 text-muted-foreground">
                  Appointment booking UI is shaped for patient search, doctor availability, and
                  conflict-safe slot selection once the backend contract lands.
                </p>
              </div>
            </div>
            <Button className="brand-button h-11 rounded-lg px-5">
              <Plus className="size-4" />
              New appointment
            </Button>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {appointmentStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <span
                    className={
                      stat.change.startsWith('-')
                        ? 'tabular text-sm font-semibold text-rose-600'
                        : 'tabular text-sm font-semibold text-emerald-600'
                    }
                  >
                    {stat.change}
                  </span>
                </div>
                <p className="tabular mt-4 text-3xl font-bold tracking-[-0.05em]">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-card p-8">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <h2 className="font-bold">Failure mode</h2>
              <p className="text-sm text-muted-foreground">Fail closed on API degradation</p>
            </div>
          </div>
          <p className="text-pretty mt-6 leading-7 text-muted-foreground">
            Unavailable or conflicting appointment state should halt the workflow instead of
            falling back to stale data.
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <div className="dashboard-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-6">
            <div>
              <h2 className="text-xl font-bold tracking-[-0.03em]">Today&apos;s Schedule</h2>
              <p className="mt-1 text-sm text-muted-foreground">Prepared for live appointment rows</p>
            </div>
            <CalendarDays className="size-5 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border">
            {scheduleRows.map((row) => (
              <div key={`${row.time}-${row.doctor}`} className="grid gap-4 px-6 py-5 md:grid-cols-[90px_1fr_130px_120px] md:items-center">
                <p className="tabular text-lg font-bold">{row.time}</p>
                <div>
                  <p className="font-semibold">{row.doctor}</p>
                  <p className="text-sm text-muted-foreground">{row.type}</p>
                </div>
                <Badge className="rounded-lg" variant="outline">
                  {row.room}
                </Badge>
                <button className="flex items-center justify-start gap-2 text-sm font-semibold md:justify-end">
                  Details
                  <ArrowRight className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5">
          <div className="dashboard-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                <UsersRound className="size-5" />
              </div>
              <div>
                <p className="font-bold">Patient intake</p>
                <p className="text-sm text-muted-foreground">Ready for identity matching</p>
              </div>
            </div>
          </div>
          <div className="dashboard-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Stethoscope className="size-5" />
              </div>
              <div>
                <p className="font-bold">Doctor capacity</p>
                <p className="text-sm text-muted-foreground">Slot availability signals reserved</p>
              </div>
            </div>
          </div>
          <div className="dashboard-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                <Clock3 className="size-5" />
              </div>
              <div>
                <p className="font-bold">SLA window</p>
                <p className="text-sm text-muted-foreground">Average booking time 6m 24s</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
