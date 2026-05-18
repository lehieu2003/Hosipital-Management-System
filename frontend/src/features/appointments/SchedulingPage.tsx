import { useMemo, useState, type FormEvent } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { OperationalStateView } from '@/features/opd/components/OperationalStateView';

import type { ScheduleAppointmentInput, SchedulableDoctor } from './api';
import {
  resolveSchedulingBoundaryState,
  resolveSchedulingSubmissionState,
  useSchedulableDoctorsQuery,
  useScheduleAppointmentMutation,
} from './hooks';
import { SchedulingField } from './components/scheduling-field';
import { SchedulingStateCard } from './components/scheduling-state-card';
import { SectionHeading } from './components/section-heading';

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
  const selectedDoctor = findDoctorById(readyDoctors, formState.doctorUserId);
  const scheduledDoctor = scheduleMutation.data
    ? findDoctorById(readyDoctors, scheduleMutation.data.appointment.doctorUserId)
    : null;

  return (
    <section
      className="space-y-5 sm:space-y-6"
      data-schedulable-doctor-count={String(readyDoctors.length)}
      data-testid="reception-scheduling-page"
    >
      <div className="dashboard-card p-6 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <Badge className="brand-soft rounded-full px-3 py-1 text-[11px] sm:text-xs" variant="secondary">
            Reception workspace
          </Badge>
          <Badge className="rounded-full border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 sm:text-xs" variant="outline">
            {readyDoctors.length} schedulable {readyDoctors.length === 1 ? 'doctor' : 'doctors'}
          </Badge>
          <Badge className="rounded-full border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 sm:text-xs" variant="outline">
            Live admin configuration
          </Badge>
        </div>
        <div className="mt-5 max-w-4xl space-y-3 sm:mt-6">
          <h2 className="text-balance text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-3xl">
            Scheduling workspace
          </h2>
          <p className="text-pretty text-[15px] leading-7 text-slate-600 sm:text-base">
            Register the patient first, then book the visit against the live Node backend with
            explicit states for directory lookup, registration, booking outcomes, and the assigned
            department that made the doctor schedulable.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px] xl:items-start">
        <Card className="dashboard-card overflow-hidden border-border rounded-[28px] sm:rounded-[30px]">
          <CardHeader className="gap-4 border-b border-slate-200/70 pb-5 sm:pb-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 shadow-sm">
                <CalendarClock className="size-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <CardTitle className="text-xl">Register and book</CardTitle>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Choose a doctor from the verified directory, capture the patient details once,
                  then create the appointment in one bounded workflow.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 lg:p-6">
            <form className="space-y-6 sm:space-y-7" data-testid="reception-scheduling-form" onSubmit={(event) => void handleSubmit(event)}>
              <div className="space-y-4">
                <SectionHeading
                  eyebrow="Patient intake"
                  title="Registration details"
                  description="These details are captured first so appointment creation never runs without a patient record."
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <SchedulingField htmlFor="patient-full-name" label="Patient full name">
                    <Input className="h-11 rounded-xl border-slate-200 bg-white" data-testid="patient-full-name-input" id="patient-full-name" name="fullName" onChange={(event) => handleFieldChange('fullName', event.target.value)} required value={formState.fullName} />
                  </SchedulingField>

                  <SchedulingField htmlFor="patient-primary-phone" label="Primary phone">
                    <Input className="h-11 rounded-xl border-slate-200 bg-white" data-testid="patient-primary-phone-input" id="patient-primary-phone" name="primaryPhone" onChange={(event) => handleFieldChange('primaryPhone', event.target.value)} required value={formState.primaryPhone} />
                  </SchedulingField>

                  <SchedulingField htmlFor="patient-email" label="Email">
                    <Input className="h-11 rounded-xl border-slate-200 bg-white" data-testid="patient-email-input" id="patient-email" name="email" onChange={(event) => handleFieldChange('email', event.target.value)} type="email" value={formState.email} />
                  </SchedulingField>

                  <SchedulingField htmlFor="patient-date-of-birth" label="Date of birth">
                    <Input className="h-11 rounded-xl border-slate-200 bg-white" data-testid="patient-date-of-birth-input" id="patient-date-of-birth" name="dateOfBirth" onChange={(event) => handleFieldChange('dateOfBirth', event.target.value)} type="date" value={formState.dateOfBirth} />
                  </SchedulingField>

                  <SchedulingField htmlFor="patient-gender" label="Gender">
                    <select
                      className="focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
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
                  </SchedulingField>
                </div>

                <SchedulingField htmlFor="patient-address" label="Address">
                  <textarea
                    className="focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                    data-testid="patient-address-input"
                    id="patient-address"
                    name="address"
                    onChange={(event) => handleFieldChange('address', event.target.value)}
                    value={formState.address}
                  />
                </SchedulingField>
              </div>

              <div className="space-y-4 rounded-[24px] border border-slate-200/80 bg-slate-50/75 p-4 sm:rounded-[28px] sm:p-5 lg:p-6">
                <SectionHeading
                  eyebrow="Booking"
                  title="Appointment details"
                  description="Choose from the live doctor directory and capture the slot before submitting the bounded workflow."
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <SchedulingField htmlFor="appointment-doctor-user-id" label="Assigned doctor">
                    <select
                      className="focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                      data-testid="appointment-doctor-select"
                      id="appointment-doctor-user-id"
                      name="doctorUserId"
                      onChange={(event) => handleFieldChange('doctorUserId', event.target.value)}
                      required
                      value={formState.doctorUserId}
                    >
                      <option value="">Select an assigned doctor</option>
                      {readyDoctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {formatDoctorDirectoryLabel(doctor)}
                        </option>
                      ))}
                    </select>
                  </SchedulingField>

                  <SchedulingField htmlFor="appointment-scheduled-at" label="Scheduled for">
                    <Input className="h-11 rounded-xl border-slate-200 bg-white" data-testid="appointment-scheduled-at-input" id="appointment-scheduled-at" name="scheduledAt" onChange={(event) => handleFieldChange('scheduledAt', event.target.value)} required type="datetime-local" value={formState.scheduledAt} />
                  </SchedulingField>

                  <SchedulingField htmlFor="appointment-duration-minutes" label="Duration (minutes)">
                    <Input className="h-11 rounded-xl border-slate-200 bg-white" data-testid="appointment-duration-minutes-input" id="appointment-duration-minutes" max={1440} min={1} name="durationMinutes" onChange={(event) => handleFieldChange('durationMinutes', event.target.value)} required type="number" value={formState.durationMinutes} />
                  </SchedulingField>
                </div>

                {selectedDoctor ? (
                  <Alert className="rounded-2xl border-cyan-200/60 bg-cyan-50/80 text-cyan-950" data-testid="selected-doctor-context">
                    <CheckCircle2 className="size-4" />
                    <AlertTitle>{selectedDoctor.username}</AlertTitle>
                    <AlertDescription>
                      Scheduling against the live {selectedDoctor.departmentName} department assignment.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <SchedulingField htmlFor="appointment-notes" label="Notes">
                  <textarea
                    className="focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                    data-testid="appointment-notes-input"
                    id="appointment-notes"
                    name="notes"
                    onChange={(event) => handleFieldChange('notes', event.target.value)}
                    value={formState.notes}
                  />
                </SchedulingField>
              </div>

              {validationState ? (
                <Alert
                  className="rounded-2xl border-amber-300/40 bg-amber-50 text-amber-950"
                  data-screen-code={validationState.code}
                  data-screen-status="invalid"
                  data-testid="reception-scheduling-validation-state"
                >
                  <CircleAlert className="size-4" />
                  <AlertTitle>Fix the scheduling form</AlertTitle>
                  <AlertDescription>{validationState.message}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col gap-4 rounded-[24px] border border-slate-200/80 bg-white/70 p-4 sm:rounded-[28px] sm:p-4 lg:flex-row lg:items-center lg:justify-between">
                <p className="max-w-xl text-sm leading-6 text-slate-500">
                  Submit creates the patient first, then books the appointment. If either live step
                  fails, the workflow stays explicit and fail-closed.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button
                    aria-busy={scheduleMutation.isPending}
                    className="brand-button h-11 w-full rounded-xl px-5 sm:w-auto"
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
                  <Button className="h-11 w-full rounded-xl px-5 sm:w-auto" data-testid="schedule-reset-button" onClick={handleReset} type="button" variant="outline">
                    Reset form
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {boundaryState.status === 'empty' ? (
            <SchedulingStateCard
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

          <SchedulingStateCard
            code={submissionState.code}
            description={submissionState.description}
            diagnostics={submissionState.diagnostics}
            icon={renderStateIcon(submissionState.status)}
            metadata={{
              'data-appointment-id': scheduleMutation.data?.appointment.id,
              'data-appointment-status': scheduleMutation.data?.appointment.status,
              'data-appointment-version': scheduleMutation.data
                ? String(scheduleMutation.data.appointment.version)
                : undefined,
              'data-department-id': scheduledDoctor?.departmentId,
              'data-department-name': scheduledDoctor?.departmentName,
              'data-doctor-user-id': scheduleMutation.data?.appointment.doctorUserId,
              'data-patient-registration-number': scheduleMutation.data?.patient.registrationNumber,
            }}
            status={submissionState.status}
            testId={submissionState.testId}
            title={submissionState.title}
            tone={stateTone(submissionState.status)}
          >
            {scheduleMutation.data ? (
              <dl className="grid gap-3 rounded-3xl border border-current/10 bg-white/85 p-5 text-sm">
                <SummaryRow label="Registration number" testId="scheduled-patient-registration-number" value={scheduleMutation.data.patient.registrationNumber} />
                <SummaryRow label="Appointment ID" testId="scheduled-appointment-id" value={scheduleMutation.data.appointment.id} />
                <SummaryRow label="Appointment status" testId="scheduled-appointment-status" value={scheduleMutation.data.appointment.status} />
                <SummaryRow label="Appointment version" testId="scheduled-appointment-version" value={String(scheduleMutation.data.appointment.version)} />
                <SummaryRow label="Selected doctor" testId="scheduled-appointment-doctor" value={scheduledDoctor ? scheduledDoctor.username : scheduleMutation.data.appointment.doctorUserId} />
                <SummaryRow label="Assigned department" testId="scheduled-appointment-department" value={scheduledDoctor?.departmentName ?? 'Unknown department'} />
              </dl>
            ) : null}
          </SchedulingStateCard>

          {readyDoctors.length > 0 ? (
            <Card className="dashboard-card border-border rounded-[28px] sm:rounded-[30px]" data-testid="schedulable-doctor-directory-card">
              <CardHeader className="gap-2 pb-4">
                <CardTitle className="text-lg">Live assigned directory</CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  These doctor options come from the live admin department assignment workflow.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {readyDoctors.map((doctor) => (
                  <div
                    key={`${doctor.id}-${doctor.departmentId}`}
                    className="rounded-2xl border border-slate-200/70 bg-white/75 p-4"
                    data-department-id={doctor.departmentId}
                    data-department-name={doctor.departmentName}
                    data-doctor-user-id={doctor.id}
                    data-testid={`schedulable-doctor-directory-row-${doctor.id}`}
                  >
                    <p className="font-medium text-slate-950">{doctor.username}</p>
                    <p className="mt-1 text-sm text-slate-500">Assigned to {doctor.departmentName}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card className="dashboard-card border-border rounded-[28px] sm:rounded-[30px]">
            <CardHeader className="gap-2 pb-4">
              <CardTitle className="text-lg">Workflow guarantees</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                The receptionist flow stays truthful to the live contract, not to placeholder shell copy.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p data-testid="scheduling-no-raw-doctor-id-note">
                Doctors come only from the verified directory. The page never asks for a raw
                <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-900">doctorUserId</code>
                value.
              </p>
              <ul className="space-y-3">
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

  function handleFieldChange<Key extends keyof SchedulingFormState>(field: Key, value: SchedulingFormState[Key]) {
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

function SummaryRow(props: { label: string; testId?: string; value: string }) {
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

function validation(field: keyof SchedulingFormState, message: string): { validation: ValidationState } {
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

function findDoctorById(doctors: SchedulableDoctor[], doctorId: string) {
  return doctors.find((entry) => entry.id === doctorId) ?? null;
}

function formatDoctorDirectoryLabel(doctor: SchedulableDoctor) {
  return `${doctor.username} — ${doctor.departmentName}`;
}
