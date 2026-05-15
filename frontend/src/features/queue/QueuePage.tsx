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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OperationalStateView } from '@/features/opd/components/OperationalStateView';

import type { DoctorQueueAppointment } from './api';
import {
  resolveDoctorQueueActionState,
  resolveDoctorQueueBoundaryState,
  useDoctorQueueQuery,
  useUpdateDoctorQueueAppointmentMutation,
} from './hooks';

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
    <section className="space-y-5" data-testid="doctor-queue-page">
      <div className="dashboard-card p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="brand-soft rounded-lg" variant="secondary">
            Doctor
          </Badge>
          <Badge
            className="rounded-lg"
            data-testid="doctor-queue-polling-badge"
            variant="outline"
          >
            Polling every 15s
          </Badge>
          {queueQuery.isFetching ? (
            <Badge
              className="rounded-lg border-cyan-200 bg-cyan-50 text-cyan-900"
              data-testid="doctor-queue-refreshing-badge"
              variant="outline"
            >
              <RefreshCw className="mr-1 size-3.5 animate-spin" />
              Refreshing
            </Badge>
          ) : null}
        </div>
        <h2 className="mt-5 text-3xl font-bold tracking-[-0.04em]">Queue workspace</h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Review the live active queue, then advance each appointment through check-in and visit
          completion with explicit fail-closed states for conflicts, forbidden writes, and backend
          outages.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <Card className="dashboard-card border-border">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                <ClipboardList className="size-5" />
              </div>
              <div>
                <CardTitle>Active queue</CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  The backend remains authoritative for queue ownership, ordering, and lifecycle
                  transitions.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {boundaryState.status === 'empty' ? (
              <StateCard
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
              <div className="space-y-4" data-testid="doctor-queue-list">
                {queue.map((appointment) => {
                  const action = nextActionForAppointment(appointment);
                  const isUpdating =
                    updateMutation.isPending && activeMutationAppointmentId === appointment.id;

                  return (
                    <Card
                      className="border-border rounded-3xl"
                      data-appointment-id={appointment.id}
                      data-appointment-status={appointment.status}
                      data-appointment-version={appointment.version}
                      data-testid={`doctor-queue-item-${appointment.id}`}
                      key={appointment.id}
                    >
                      <CardContent className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-semibold">{appointment.patient.fullName}</h3>
                            <Badge
                              className="rounded-lg"
                              data-testid={`doctor-queue-status-${appointment.id}`}
                              variant="outline"
                            >
                              {formatStatusLabel(appointment.status)}
                            </Badge>
                          </div>
                          <dl className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                            <QueueFact label="Registration" value={appointment.patient.registrationNumber} />
                            <QueueFact label="Phone" value={appointment.patient.primaryPhone} />
                            <QueueFact label="Scheduled for" value={formatDateTime(appointment.scheduledAt)} />
                            <QueueFact label="Visit length" value={`${appointment.durationMinutes} minutes`} />
                            <QueueFact label="Queue version" value={String(appointment.version)} valueTestId={`doctor-queue-version-${appointment.id}`} />
                            <QueueFact label="Patient ID" value={appointment.patient.id} />
                          </dl>
                        </div>

                        <div className="flex min-w-56 flex-col gap-3">
                          <Button
                            aria-busy={isUpdating}
                            className="brand-button h-11 rounded-lg px-5"
                            data-testid={action.testId}
                            disabled={isUpdating || updateMutation.isPending}
                            onClick={() => {
                              void updateMutation.mutateAsync({
                                appointmentId: appointment.id,
                                status: action.nextStatus,
                                version: appointment.version,
                              }).catch(() => undefined);
                            }}
                            type="button"
                          >
                            {isUpdating ? (
                              <>
                                Updating...
                                <LoaderCircle className="size-4 animate-spin" />
                              </>
                            ) : (
                              action.label
                            )}
                          </Button>
                          <p className="text-sm leading-6 text-muted-foreground" data-testid={`doctor-queue-next-step-${appointment.id}`}>
                            {action.description}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <StateCard
            code={actionState.code}
            description={actionState.description}
            diagnostics={actionState.diagnostics}
            icon={renderStateIcon(actionState.status)}
            status={actionState.status}
            testId={actionState.testId}
            title={actionState.title}
            tone={stateTone(actionState.status)}
          >
            {updateMutation.data ? (
              <dl className="grid gap-3 rounded-2xl border border-current/10 bg-white/80 p-5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-medium">Patient</dt>
                  <dd data-testid="doctor-queue-last-patient">{updateMutation.data.patient.fullName}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-medium">Backend status</dt>
                  <dd data-testid="doctor-queue-last-status">{updateMutation.data.status}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-medium">Updated version</dt>
                  <dd data-testid="doctor-queue-last-version">{updateMutation.data.version}</dd>
                </div>
              </dl>
            ) : null}
          </StateCard>

          <Card className="dashboard-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Queue guarantees</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p data-testid="doctor-queue-version-note">
                Every queue action sends the current
                <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-slate-900">version</code>
                from the rendered appointment card.
              </p>
              <ul className="space-y-2">
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

function QueueFact(props: { label: string; value: string; valueTestId?: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
        {props.label}
      </dt>
      <dd className="text-sm text-foreground" data-testid={props.valueTestId}>
        {props.value}
      </dd>
    </div>
  );
}

function StateCard(props: {
  children?: React.ReactNode;
  code: string;
  description: string;
  diagnostics: string[];
  icon: React.ReactNode;
  status: string;
  testId: string;
  title: string;
  tone: string;
}) {
  return (
    <Card
      className={`dashboard-card ${props.tone}`}
      data-screen-code={props.code}
      data-screen-status={props.status}
      data-testid={props.testId}
    >
      <CardHeader className="space-y-4">
        <div className="flex size-11 items-center justify-center rounded-xl bg-white/80 shadow-sm">
          {props.icon}
        </div>
        <div className="space-y-2">
          <CardTitle>{props.title}</CardTitle>
          <p className="text-sm leading-6 opacity-90">{props.description}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {props.children}
        <div className="rounded-2xl border border-current/10 bg-white/70 p-5">
          <p className="text-sm font-semibold">Diagnostics</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 opacity-90">
            {props.diagnostics.map((diagnostic) => (
              <li key={diagnostic}>• {diagnostic}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
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
