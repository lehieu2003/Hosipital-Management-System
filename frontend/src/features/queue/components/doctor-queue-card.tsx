import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import type { DoctorQueueAppointment } from '../api';
import { QueueFact } from './queue-fact';

type QueueAction = {
  description: string;
  label: string;
  nextStatus: 'CHECKED_IN' | 'COMPLETED';
  testId: string;
};

type DoctorQueueCardProps = {
  action: QueueAction;
  appointment: DoctorQueueAppointment;
  disableAction: boolean;
  isUpdating: boolean;
  onAdvance: () => void;
};

export function DoctorQueueCard({
  action,
  appointment,
  disableAction,
  isUpdating,
  onAdvance,
}: DoctorQueueCardProps) {
  return (
    <Card
      className="overflow-hidden rounded-[28px] border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]"
      data-appointment-id={appointment.id}
      data-appointment-status={appointment.status}
      data-appointment-version={appointment.version}
      data-testid={`doctor-queue-item-${appointment.id}`}
    >
      <CardContent className="p-0">
        <div className="border-b border-slate-200/70 px-5 py-5 lg:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={statusBadgeTone(appointment.status)} variant="outline">
                  {formatStatusLabel(appointment.status)}
                </Badge>
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  Live appointment
                </span>
              </div>
              <div className="space-y-1">
                <h3 className="text-balance text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  {appointment.patient.fullName}
                </h3>
                <p className="text-sm leading-6 text-slate-500">{action.description}</p>
              </div>
            </div>

            <div className="min-w-full lg:min-w-[240px] lg:max-w-[260px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
                <Button
                  aria-busy={isUpdating}
                  className="brand-button h-11 w-full rounded-xl px-5 text-sm font-semibold"
                  data-testid={action.testId}
                  disabled={isUpdating || disableAction}
                  onClick={onAdvance}
                  type="button"
                >
                  {isUpdating ? 'Updating...' : action.label}
                </Button>
                <p
                  className="mt-3 text-sm leading-6 text-slate-500"
                  data-testid={`doctor-queue-next-step-${appointment.id}`}
                >
                  Uses the current rendered version before the queue refetches authoritatively.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 xl:grid-cols-3 lg:px-6">
          <QueueFact label="Registration" value={appointment.patient.registrationNumber} />
          <QueueFact label="Phone" value={appointment.patient.primaryPhone} />
          <QueueFact label="Scheduled for" value={formatDateTime(appointment.scheduledAt)} />
          <QueueFact label="Visit length" value={`${appointment.durationMinutes} minutes`} />
          <QueueFact
            label="Queue version"
            value={String(appointment.version)}
            valueTestId={`doctor-queue-version-${appointment.id}`}
          />
          <QueueFact label="Patient ID" value={appointment.patient.id} variant="mono" />
        </div>
      </CardContent>
    </Card>
  );
}

function statusBadgeTone(status: DoctorQueueAppointment['status']) {
  if (status === 'CHECKED_IN') {
    return 'rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-900';
  }

  return 'rounded-full border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-900';
}

function formatStatusLabel(status: DoctorQueueAppointment['status']) {
  return status === 'SCHEDULED' ? 'Scheduled' : 'Checked in';
}

function formatDateTime(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}
