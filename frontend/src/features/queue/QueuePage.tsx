import { useMemo } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OperationalStateView } from '@/features/opd/components/OperationalStateView';

import type { DoctorQueueAppointment } from '@/api';
import {
  resolveDoctorQueueActionState,
  resolveDoctorQueueBoundaryState,
  useDoctorQueueQuery,
  useUpdateDoctorQueueAppointmentMutation,
} from './hooks';
import { DoctorQueueCard } from './components/doctor-queue-card';
import { QueueStateCard } from './components/queue-state-card';

export function QueuePage() {
  const queueQuery = useDoctorQueueQuery();
  const updateMutation = useUpdateDoctorQueueAppointmentMutation();

  const boundaryState = useMemo(
    () => resolveDoctorQueueBoundaryState(queueQuery.data, queueQuery.error),
    [queueQuery.data, queueQuery.error],
  );
  const actionState = useMemo(
    () =>
      resolveDoctorQueueActionState({
        data: updateMutation.data,
        error: updateMutation.error,
        isPending: updateMutation.isPending,
      }),
    [updateMutation.data, updateMutation.error, updateMutation.isPending],
  );

  if (queueQuery.isPending && !queueQuery.data) {
    return (
      <OperationalStateView
        description="Loading the live doctor queue before any patient progression controls render."
        isLoading
        roleLabel="Doctor"
        screenId="doctor-queue"
        title="Queue workspace"
      />
    );
  }

  if (boundaryState.status === 'forbidden' || boundaryState.status === 'unavailable') {
    return (
      <OperationalStateView
        description="Doctor queue access stays fail closed whenever live queue polling or lifecycle prerequisites cannot be verified against the Node contract."
        foundation={{
          capabilities: [
            'Live queue reads stay doctor-owned and never trust caller-supplied doctor identifiers.',
            'Lifecycle updates always send the current appointment version.',
            'Stable screen codes remain available for browser and Vitest verification.',
          ],
          code: boundaryState.status === 'forbidden' ? 'FORBIDDEN' : 'UNAVAILABLE',
          description: boundaryState.description,
          diagnostics: boundaryState.diagnostics,
          role: 'doctor',
          screenId: 'doctor-queue',
          status: boundaryState.status,
          title: boundaryState.title,
        }}
        isLoading={false}
        roleLabel="Doctor"
        screenId="doctor-queue"
        title="Queue workspace"
      />
    );
  }

  const queue = queueQuery.data ?? [];
  const activeMutationAppointmentId = updateMutation.variables?.appointmentId ?? null;

  return (
    <section
      className="space-y-6"
      data-active-queue-count={String(queue.length)}
      data-testid="doctor-queue-page"
    >
      <div className="dashboard-card p-8 lg:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="brand-soft rounded-full px-3 py-1" variant="secondary">
            Doctor workspace
          </Badge>
          <Badge
            className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700"
            data-testid="doctor-queue-polling-badge"
            variant="outline"
          >
            Polling every 15s
          </Badge>
          <Badge className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700" variant="outline">
            {queue.length} active {queue.length === 1 ? 'visit' : 'visits'}
          </Badge>
          {queueQuery.isFetching ? (
            <Badge
              className="rounded-full border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-900"
              data-testid="doctor-queue-refreshing-badge"
              variant="outline"
            >
              <RefreshCw className="size-3.5 animate-spin" />
              Refreshing
            </Badge>
          ) : null}
        </div>
        <div className="mt-6 max-w-4xl space-y-3">
          <h2 className="text-balance text-3xl font-bold tracking-[-0.04em] text-slate-950">
            Queue workspace
          </h2>
          <p className="text-pretty text-base leading-7 text-slate-600">
            Review the live queue, move each patient through check-in and visit completion, and
            keep conflict or outage states explicit instead of hiding operational risk.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px] xl:items-start">
        <Card className="dashboard-card overflow-hidden border-border rounded-[30px]">
          <CardHeader className="gap-4 border-b border-slate-200/70 pb-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 shadow-sm">
                <ClipboardList className="size-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <CardTitle className="text-xl">Active queue</CardTitle>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Queue ownership, ordering, and lifecycle state remain backend-authoritative.
                  The UI only renders what the live Node contract can prove.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 lg:p-6">
            {boundaryState.status === 'empty' ? (
              <QueueStateCard
                code={boundaryState.code}
                description={boundaryState.description}
                diagnostics={boundaryState.diagnostics}
                icon={<TriangleAlert className="size-5" />}
                status="empty"
                testId="doctor-queue-empty-state"
                title={boundaryState.title}
                tone="border-slate-200 bg-slate-50/80 text-slate-950"
              />
            ) : (
              <div className="space-y-5" data-testid="doctor-queue-list">
                {queue.map((appointment) => {
                  const action = nextActionForAppointment(appointment);
                  const isUpdating =
                    updateMutation.isPending && activeMutationAppointmentId === appointment.id;

                  return (
                    <DoctorQueueCard
                      action={action}
                      appointment={appointment}
                      disableAction={updateMutation.isPending}
                      isUpdating={isUpdating}
                      key={appointment.id}
                      onAdvance={() => {
                        void updateMutation
                          .mutateAsync({
                            appointmentId: appointment.id,
                            status: action.nextStatus,
                            version: appointment.version,
                          })
                          .catch(() => undefined);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <QueueStateCard
            code={actionState.code}
            description={actionState.description}
            diagnostics={actionState.diagnostics}
            icon={renderStateIcon(actionState.status)}
            metadata={{
              'data-last-appointment-id': updateMutation.data?.id,
              'data-last-appointment-status': updateMutation.data?.status,
              'data-last-appointment-version': updateMutation.data
                ? String(updateMutation.data.version)
                : undefined,
            }}
            status={actionState.status}
            testId={actionState.testId}
            title={actionState.title}
            tone={stateTone(actionState.status)}
          >
            {updateMutation.data ? (
              <dl className="grid gap-3 rounded-3xl border border-current/10 bg-white/85 p-5 text-sm">
                <SummaryRow label="Patient" testId="doctor-queue-last-patient" value={updateMutation.data.patient.fullName} />
                <SummaryRow label="Backend status" testId="doctor-queue-last-status" value={updateMutation.data.status} />
                <SummaryRow label="Updated version" testId="doctor-queue-last-version" value={String(updateMutation.data.version)} />
              </dl>
            ) : null}
          </QueueStateCard>

          <Card className="dashboard-card border-border rounded-[30px]">
            <CardHeader className="gap-2 pb-4">
              <CardTitle className="text-lg">Queue guarantees</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                The queue never invents state when the backend cannot prove it.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p data-testid="doctor-queue-version-note">
                Every queue action sends the rendered
                <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-900">version</code>
                for that appointment.
              </p>
              <ul className="space-y-3">
                <li>• Queue reads never fall back to placeholder or stale mock data after failure.</li>
                <li>• Mutation success forces an explicit queue invalidation before the next poll.</li>
                <li>• Focus refetch remains enabled through the shared React Query client.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function SummaryRow(props: { label: string; testId: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 pb-3 last:border-b-0 last:pb-0">
      <dt className="font-medium">{props.label}</dt>
      <dd className="text-right [font-variant-numeric:tabular-nums]" data-testid={props.testId}>
        {props.value}
      </dd>
    </div>
  );
}

function renderStateIcon(status: string) {
  if (status === 'pending') {
    return <LoaderCircle className="size-5 animate-spin" />;
  }

  if (status === 'success') {
    return <CheckCircle2 className="size-5" />;
  }

  if (status === 'forbidden') {
    return <ShieldAlert className="size-5" />;
  }

  if (status === 'conflict') {
    return <CircleAlert className="size-5" />;
  }

  if (status === 'unavailable' || status === 'empty') {
    return <TriangleAlert className="size-5" />;
  }

  return <ClipboardList className="size-5" />;
}

function stateTone(status: string) {
  if (status === 'success') {
    return 'border-emerald-200 bg-emerald-50/70 text-emerald-950';
  }

  if (status === 'forbidden') {
    return 'border-amber-200 bg-amber-50/70 text-amber-950';
  }

  if (status === 'conflict') {
    return 'border-rose-200 bg-rose-50/70 text-rose-950';
  }

  if (status === 'unavailable' || status === 'empty') {
    return 'border-slate-200 bg-slate-50/80 text-slate-950';
  }

  return 'border-cyan-200 bg-cyan-50/70 text-cyan-950';
}

function nextActionForAppointment(appointment: DoctorQueueAppointment) {
  if (appointment.status === 'SCHEDULED') {
    return {
      description: 'Advance this patient from scheduled to checked in with the current rendered version.',
      label: 'Check in patient',
      nextStatus: 'CHECKED_IN' as const,
      testId: `queue-action-check-in-${appointment.id}`,
    };
  }

  return {
    description: 'Complete the visit and let the authoritative queue refresh remove the finished item.',
    label: 'Complete visit',
    nextStatus: 'COMPLETED' as const,
    testId: `queue-action-complete-${appointment.id}`,
  };
}
