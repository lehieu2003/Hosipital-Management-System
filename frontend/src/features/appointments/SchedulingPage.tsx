import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { CalendarClock, CheckCircle2, CircleAlert, LoaderCircle, ShieldAlert, TriangleAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { OperationalStateView } from '@/features/opd/components/OperationalStateView';

import {
  resolveSchedulingBoundaryState,
  resolveSchedulingSubmissionState,
  useSchedulableDoctorsQuery,
  useScheduleAppointmentMutation,
} from './hooks';
import type { ScheduleAppointmentInput } from './api';

type SchedulingFormState = {
  fullName: string;
  primaryPhone: string;
  email: string;
  dateOfBirth: string;
  gender: 'UNSPECIFIED' | 'FEMALE' | 'MALE' | 'OTHER';
  address: string;
  doctorUserId: string;
  scheduledAt: string;
  durationMinutes: string;
  notes: string;
};

type ValidationState = {
  code: 'INVALID_FORM';
  field: keyof SchedulingFormState;
  message: string;
};

const INITIAL_FORM_STATE: SchedulingFormState = {
  fullName: '',
  primaryPhone: '',
  email: '',
  dateOfBirth: '',
  gender: 'UNSPECIFIED',
  address: '',
  doctorUserId: '',
  scheduledAt: '',
  durationMinutes: '30',
  notes: '',
};

export function SchedulingPage() {
  const [formState, setFormState] = useState<SchedulingFormState>(INITIAL_FORM_STATE);
  const [validationState, setValidationState] = useState<ValidationState | null>(null);
  const doctorsQuery = useSchedulableDoctorsQuery();
  const scheduleMutation = useScheduleAppointmentMutation();

  const boundaryState = useMemo(
    () => resolveSchedulingBoundaryState(doctorsQuery.data, doctorsQuery.error),
    [doctorsQuery.data, doctorsQuery.error],
  );
  const submissionState = useMemo(
    () =>
      resolveSchedulingSubmissionState({
        data: scheduleMutation.data,
        error: scheduleMutation.error,
        isPending: scheduleMutation.isPending,
      }),
    [scheduleMutation.data, scheduleMutation.error, scheduleMutation.isPending],
  );

  if (doctorsQuery.isPending) {
    return (
      <OperationalStateView
        description="Loading the live doctor directory before the receptionist workflow can render any scheduling controls."
        isLoading
        roleLabel="Receptionist"
        screenId="reception-scheduling"
        title="Scheduling workspace"
      />
    );
  }

  if (boundaryState.status === 'forbidden' || boundaryState.status === 'unavailable') {
    return (
      <OperationalStateView
        description="Reception scheduling stays fail closed whenever doctor discovery or booking prerequisites cannot be verified against the live Node contract."
        foundation={{
          capabilities: [
            'Patient registration happens before appointment creation.',
            'Doctor selection is directory-backed and never falls back to raw IDs.',
            'Stable screen codes remain available for verification and browser proofs.',
          ],
          code: boundaryState.status === 'forbidden' ? 'FORBIDDEN' : 'UNAVAILABLE',
          description: boundaryState.description,
          diagnostics: boundaryState.diagnostics,
          role: 'receptionist',
          screenId: 'reception-scheduling',
          status: boundaryState.status,
          title: boundaryState.title,
        }}
        isLoading={false}
        roleLabel="Receptionist"
        screenId="reception-scheduling"
        title="Scheduling workspace"
      />
    );
  }

  const readyDoctors = doctorsQuery.data ?? [];

  return (
    <section className="space-y-5" data-testid="reception-scheduling-page">
      <div className="dashboard-card p-8">
        <Badge className="brand-soft rounded-lg" variant="secondary">
          Receptionist
        </Badge>
        <h2 className="mt-5 text-3xl font-bold tracking-[-0.04em]">Scheduling workspace</h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Register the patient first, then book the appointment against the live Node backend with
          explicit fail-closed states for doctor discovery, registration, and booking outcomes.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <Card className="dashboard-card border-border">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                <CalendarClock className="size-5" />
              </div>
              <div>
                <CardTitle>Register and book</CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  Choose a doctor from the verified directory, capture the patient registration, and
                  create the appointment in one bounded workflow.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" data-testid="reception-scheduling-form" onSubmit={(event) => void handleSubmit(event)}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Patient full name" htmlFor="patient-full-name">
                  <Input
                    className="h-11 rounded-lg"
                    data-testid="patient-full-name-input"
                    id="patient-full-name"
                    name="fullName"
                    onChange={(event) => handleFieldChange('fullName', event.target.value)}
                    required
                    value={formState.fullName}
                  />
                </Field>

                <Field label="Primary phone" htmlFor="patient-primary-phone">
                  <Input
                    className="h-11 rounded-lg"
                    data-testid="patient-primary-phone-input"
                    id="patient-primary-phone"
                    name="primaryPhone"
                    onChange={(event) => handleFieldChange('primaryPhone', event.target.value)}
                    required
                    value={formState.primaryPhone}
                  />
                </Field>

                <Field label="Email" htmlFor="patient-email">
                  <Input
                    className="h-11 rounded-lg"
                    data-testid="patient-email-input"
                    id="patient-email"
                    name="email"
                    onChange={(event) => handleFieldChange('email', event.target.value)}
                    type="email"
                    value={formState.email}
                  />
                </Field>

                <Field label="Date of birth" htmlFor="patient-date-of-birth">
                  <Input
                    className="h-11 rounded-lg"
                    data-testid="patient-date-of-birth-input"
                    id="patient-date-of-birth"
                    name="dateOfBirth"
                    onChange={(event) => handleFieldChange('dateOfBirth', event.target.value)}
                    type="date"
                    value={formState.dateOfBirth}
                  />
                </Field>

                <Field label="Gender" htmlFor="patient-gender">
                  <select
                    className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                    data-testid="patient-gender-select"
                    id="patient-gender"
                    name="gender"
                    onChange={(event) => handleFieldChange('gender', event.target.value as SchedulingFormState['gender'])}
                    value={formState.gender}
                  >
                    <option value="UNSPECIFIED">Unspecified</option>
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>

                <Field label="Doctor" htmlFor="appointment-doctor-user-id">
                  <select
                    className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                    data-testid="appointment-doctor-select"
                    id="appointment-doctor-user-id"
                    name="doctorUserId"
                    onChange={(event) => handleFieldChange('doctorUserId', event.target.value)}
                    required
                    value={formState.doctorUserId}
                  >
                    <option value="">Select a doctor</option>
                    {readyDoctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.username}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Scheduled for" htmlFor="appointment-scheduled-at">
                  <Input
                    className="h-11 rounded-lg"
                    data-testid="appointment-scheduled-at-input"
                    id="appointment-scheduled-at"
                    name="scheduledAt"
                    onChange={(event) => handleFieldChange('scheduledAt', event.target.value)}
                    required
                    type="datetime-local"
                    value={formState.scheduledAt}
                  />
                </Field>

                <Field label="Duration (minutes)" htmlFor="appointment-duration-minutes">
                  <Input
                    className="h-11 rounded-lg"
                    data-testid="appointment-duration-minutes-input"
                    id="appointment-duration-minutes"
                    min={1}
                    max={1440}
                    name="durationMinutes"
                    onChange={(event) => handleFieldChange('durationMinutes', event.target.value)}
                    required
                    type="number"
                    value={formState.durationMinutes}
                  />
                </Field>
              </div>

              <Field label="Address" htmlFor="patient-address">
                <textarea
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                  data-testid="patient-address-input"
                  id="patient-address"
                  name="address"
                  onChange={(event) => handleFieldChange('address', event.target.value)}
                  value={formState.address}
                />
              </Field>

              <Field label="Notes" htmlFor="appointment-notes">
                <textarea
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                  data-testid="appointment-notes-input"
                  id="appointment-notes"
                  name="notes"
                  onChange={(event) => handleFieldChange('notes', event.target.value)}
                  value={formState.notes}
                />
              </Field>

              {validationState ? (
                <Alert
                  className="border-amber-300/40 bg-amber-50 text-amber-950"
                  data-screen-code={validationState.code}
                  data-screen-status="invalid"
                  data-testid="reception-scheduling-validation-state"
                >
                  <CircleAlert className="size-4" />
                  <AlertTitle>Fix the scheduling form</AlertTitle>
                  <AlertDescription>{validationState.message}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  aria-busy={scheduleMutation.isPending}
                  className="brand-button h-11 rounded-lg px-5"
                  data-testid="schedule-submit-button"
                  disabled={scheduleMutation.isPending || boundaryState.status === 'empty'}
                  type="submit"
                >
                  {scheduleMutation.isPending ? (
                    <>
                      Scheduling...
                      <LoaderCircle className="size-4 animate-spin" />
                    </>
                  ) : (
                    'Register and schedule'
                  )}
                </Button>
                <Button
                  className="h-11 rounded-lg px-5"
                  data-testid="schedule-reset-button"
                  onClick={handleReset}
                  type="button"
                  variant="outline"
                >
                  Reset form
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {boundaryState.status === 'empty' ? (
            <StateCard
              code={boundaryState.code}
              description={boundaryState.description}
              diagnostics={boundaryState.diagnostics}
              icon={<TriangleAlert className="size-5" />}
              status="empty"
              testId="reception-scheduling-empty-state"
              title={boundaryState.title}
              tone="border-slate-200 bg-slate-50/80 text-slate-950"
            />
          ) : null}

          <StateCard
            code={submissionState.code}
            description={submissionState.description}
            diagnostics={submissionState.diagnostics}
            icon={renderStateIcon(submissionState.status)}
            status={submissionState.status}
            testId={submissionState.testId}
            title={submissionState.title}
            tone={stateTone(submissionState.status)}
          >
            {scheduleMutation.data ? (
              <dl className="grid gap-3 rounded-2xl border border-current/10 bg-white/80 p-5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-medium">Registration number</dt>
                  <dd data-testid="scheduled-patient-registration-number">
                    {scheduleMutation.data.patient.registrationNumber}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-medium">Appointment status</dt>
                  <dd data-testid="scheduled-appointment-status">
                    {scheduleMutation.data.appointment.status}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-medium">Selected doctor</dt>
                  <dd>{doctorLabelForId(readyDoctors, scheduleMutation.data.appointment.doctorUserId)}</dd>
                </div>
              </dl>
            ) : null}
          </StateCard>

          <Card className="dashboard-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Workflow guarantees</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p data-testid="scheduling-no-raw-doctor-id-note">
                Doctors come only from the verified directory. The page never asks for a raw
                <code className="mx-1 rounded bg-slate-100 px-1 py-0.5 text-slate-900">doctorUserId</code>
                value.
              </p>
              <ul className="space-y-2">
                <li>• Registration completes before appointment creation is attempted.</li>
                <li>• Refresh replay stays inside the shared API client and auth boundary.</li>
                <li>• Unavailable and forbidden outcomes stay stable for automated verification.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );

  function clearFeedback() {
    if (validationState) {
      setValidationState(null);
    }

    if (scheduleMutation.isError || scheduleMutation.isSuccess) {
      scheduleMutation.reset();
    }
  }

  function handleFieldChange<Key extends keyof SchedulingFormState>(
    field: Key,
    value: SchedulingFormState[Key],
  ) {
    clearFeedback();
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleReset() {
    setFormState(INITIAL_FORM_STATE);
    setValidationState(null);
    scheduleMutation.reset();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    const payload = toScheduleAppointmentInput(formState);
    if ('validation' in payload) {
      setValidationState(payload.validation);
      return;
    }

    try {
      await scheduleMutation.mutateAsync(payload.request);
    } catch {
      return;
    }
  }
}

function Field(props: { children: ReactNode; htmlFor: string; label: string }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={props.htmlFor}>
        {props.label}
      </label>
      {props.children}
    </div>
  );
}

function StateCard(props: {
  children?: ReactNode;
  code: string;
  description: string;
  diagnostics: string[];
  icon: ReactNode;
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

  return <CalendarClock className="size-5" />;
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

function toScheduleAppointmentInput(formState: SchedulingFormState):
  | { request: ScheduleAppointmentInput }
  | { validation: ValidationState } {
  const fullName = formState.fullName.trim();
  if (!fullName) {
    return validation('fullName', 'Patient full name is required before registration can start.');
  }

  const primaryPhone = formState.primaryPhone.trim();
  if (!primaryPhone) {
    return validation('primaryPhone', 'Primary phone is required before the patient can be registered.');
  }

  if (!formState.doctorUserId) {
    return validation('doctorUserId', 'Select a doctor from the live directory before booking.');
  }

  if (!formState.scheduledAt) {
    return validation('scheduledAt', 'Choose a valid appointment date and time before booking.');
  }

  const scheduledDate = new Date(formState.scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    return validation('scheduledAt', 'The appointment date and time must be valid.');
  }

  const durationMinutes = Number.parseInt(formState.durationMinutes, 10);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
    return validation('durationMinutes', 'Duration must be between 1 and 1440 minutes.');
  }

  return {
    request: {
      appointment: {
        doctorUserId: formState.doctorUserId,
        durationMinutes,
        notes: optionalString(formState.notes),
        scheduledAt: scheduledDate.toISOString(),
      },
      patient: {
        address: optionalString(formState.address),
        dateOfBirth: optionalString(formState.dateOfBirth),
        email: optionalString(formState.email),
        fullName,
        gender: formState.gender,
        primaryPhone,
      },
    },
  };
}

function validation(
  field: keyof SchedulingFormState,
  message: string,
): { validation: ValidationState } {
  return {
    validation: {
      code: 'INVALID_FORM',
      field,
      message,
    },
  };
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function doctorLabelForId(doctors: Array<{ id: string; username: string }>, doctorId: string) {
  const doctor = doctors.find((entry) => entry.id === doctorId);
  return doctor?.username ?? doctorId;
}
