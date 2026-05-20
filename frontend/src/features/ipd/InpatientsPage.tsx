import { useEffect, useMemo, useState } from 'react';
import {
  BedDouble,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  ShieldAlert,
  Stethoscope,
  TriangleAlert,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { OperationalStateView } from '@/features/opd/components/OperationalStateView';
import { SchedulingStateCard } from '@/features/appointments/components/scheduling-state-card';

import type { IpdAdmission, IpdOccupancyEntry } from '@/api';
import {
  createFailedInpatientsActionState,
  createInitialInpatientsActionState,
  createPendingInpatientsActionState,
  createSuccessInpatientsActionState,
  ipdMovementsQueryKey,
  resolveInpatientsBoundaryState,
  useAdmissionMovementsQuery,
  useAdmitPatientMutation,
  useAssignBedMutation,
  useDischargeAdmissionMutation,
  useIpdOccupancyQuery,
  useTransferBedMutation,
  type InpatientsActionState,
} from './hooks';

type AdmitFormState = {
  attendingDoctorUserId: string;
  notes: string;
  patientId: string;
};

type WorkflowFormState = {
  admissionId: string;
  bedId: string;
  dischargeNotes: string;
  expectedAdmissionVersion: string;
  expectedOccupancyVersion: string;
  movementNote: string;
  targetBedId: string;
};

const INITIAL_ADMIT_FORM_STATE: AdmitFormState = {
  attendingDoctorUserId: '',
  notes: '',
  patientId: '',
};

const INITIAL_WORKFLOW_FORM_STATE: WorkflowFormState = {
  admissionId: '',
  bedId: '',
  dischargeNotes: '',
  expectedAdmissionVersion: '',
  expectedOccupancyVersion: '',
  movementNote: '',
  targetBedId: '',
};

export function InpatientsPage() {
  const queryClient = useQueryClient();
  const occupancyQuery = useIpdOccupancyQuery();
  const admitMutation = useAdmitPatientMutation();
  const assignMutation = useAssignBedMutation();
  const transferMutation = useTransferBedMutation();
  const dischargeMutation = useDischargeAdmissionMutation();

  const [admitFormState, setAdmitFormState] = useState(INITIAL_ADMIT_FORM_STATE);
  const [workflowFormState, setWorkflowFormState] = useState(INITIAL_WORKFLOW_FORM_STATE);
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<InpatientsActionState>(createInitialInpatientsActionState);

  const boundaryState = useMemo(
    () => resolveInpatientsBoundaryState(occupancyQuery.data, occupancyQuery.error),
    [occupancyQuery.data, occupancyQuery.error],
  );
  const movementsQuery = useAdmissionMovementsQuery(selectedAdmissionId);
  const occupancy = occupancyQuery.data ?? [];

  useEffect(() => {
    if (!selectedAdmissionId && occupancy.length > 0) {
      hydrateWorkflowFromOccupancy(occupancy[0]);
      setSelectedAdmissionId(occupancy[0].admission.id);
    }
  }, [occupancy, selectedAdmissionId]);

  if (occupancyQuery.isPending && !occupancyQuery.data) {
    return (
      <OperationalStateView
        description='Loading the live inpatient occupancy contract before any reception bed workflow can render.'
        isLoading
        roleLabel='Reception'
        screenId='reception-inpatients'
        title='Inpatient workspace'
      />
    );
  }

  if (boundaryState.status === 'forbidden' || boundaryState.status === 'unavailable') {
    return (
      <OperationalStateView
        description='Reception inpatient operations stay fail closed whenever live occupancy or lifecycle prerequisites cannot be verified against the Node contract.'
        foundation={{
          capabilities: [
            'Reception can admit, assign, transfer, and discharge only against the live IPD contract.',
            'Current occupancy and movement history remain backend-authoritative and machine readable.',
            'Forbidden, unavailable, and conflict markers stay stable for browser and unit verification.',
          ],
          code: boundaryState.code,
          description: boundaryState.description,
          diagnostics: boundaryState.diagnostics,
          role: 'receptionist',
          screenId: 'reception-inpatients',
          status: boundaryState.status,
          title: boundaryState.title,
        }}
        isLoading={false}
        roleLabel='Reception'
        screenId='reception-inpatients'
        title='Inpatient workspace'
      />
    );
  }

  const movementsErrorCode =
    movementsQuery.error && 'rawCode' in movementsQuery.error && typeof movementsQuery.error.rawCode === 'string'
      ? movementsQuery.error.rawCode
      : 'UNAVAILABLE';

  return (
    <section
      className='space-y-6'
      data-occupancy-count={String(occupancy.length)}
      data-selected-admission-id={selectedAdmissionId ?? 'none'}
      data-testid='reception-inpatients-page'
    >
      <div className='dashboard-card p-8 lg:p-10'>
        <div className='flex flex-wrap items-center gap-3'>
          <Badge className='brand-soft rounded-full px-3 py-1' variant='secondary'>
            Reception workspace
          </Badge>
          <Badge className='rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700' variant='outline'>
            {occupancy.length} occupied {occupancy.length === 1 ? 'bed' : 'beds'}
          </Badge>
          <Badge className='rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700' variant='outline'>
            {boundaryState.code}
          </Badge>
        </div>
        <div className='mt-6 max-w-4xl space-y-3'>
          <h2 className='text-balance text-3xl font-bold tracking-[-0.04em] text-slate-950'>
            Inpatient workspace
          </h2>
          <p className='text-pretty text-base leading-7 text-slate-600'>
            Admit a patient, assign or transfer beds, discharge safely, and inspect occupancy or
            movement history without hiding backend conflicts behind placeholder success states.
          </p>
        </div>
      </div>

      <div className='grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px] xl:items-start'>
        <div className='space-y-6'>
          <Card className='dashboard-card overflow-hidden rounded-[30px] border-border'>
            <CardHeader className='gap-4 border-b border-slate-200/70 pb-6'>
              <div className='flex flex-wrap items-start gap-4'>
                <div className='flex size-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 shadow-sm'>
                  <Stethoscope className='size-5' />
                </div>
                <div className='min-w-0 flex-1 space-y-2'>
                  <CardTitle className='text-xl'>Admit patient</CardTitle>
                  <p className='max-w-2xl text-sm leading-6 text-muted-foreground'>
                    Start the inpatient lifecycle and capture the authoritative admission version
                    before any bed action begins.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className='space-y-5 p-5 lg:p-6'>
              <div className='grid gap-4 md:grid-cols-2'>
                <Field label='Patient ID'>
                  <Input
                    data-testid='ipd-patient-id-input'
                    onChange={(event) => {
                      resetActionState();
                      setAdmitFormState((current) => ({ ...current, patientId: event.target.value }));
                    }}
                    placeholder='patient-123'
                    value={admitFormState.patientId}
                  />
                </Field>
                <Field label='Attending doctor user ID'>
                  <Input
                    data-testid='ipd-attending-doctor-input'
                    onChange={(event) => {
                      resetActionState();
                      setAdmitFormState((current) => ({ ...current, attendingDoctorUserId: event.target.value }));
                    }}
                    placeholder='doctor-42'
                    value={admitFormState.attendingDoctorUserId}
                  />
                </Field>
              </div>
              <Field label='Admission notes'>
                <textarea
                  className='focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'
                  data-testid='ipd-admission-notes-input'
                  onChange={(event) => {
                    resetActionState();
                    setAdmitFormState((current) => ({ ...current, notes: event.target.value }));
                  }}
                  placeholder='Observation, handoff, or triage notes'
                  value={admitFormState.notes}
                />
              </Field>
              <div className='flex flex-col gap-4 rounded-[24px] border border-slate-200/80 bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between'>
                <p className='max-w-xl text-sm leading-6 text-slate-500'>
                  Admission success hydrates the active workflow with the backend admission ID and
                  version so the next bed action can stay conflict-safe.
                </p>
                <Button
                  className='brand-button h-11 rounded-xl px-5'
                  data-testid='ipd-admit-submit-button'
                  disabled={activeMutationIsPending() || admitFormState.patientId.trim().length === 0}
                  onClick={() => {
                    void handleAdmit();
                  }}
                  type='button'
                >
                  {admitMutation.isPending ? (
                    <>
                      Admitting...
                      <LoaderCircle className='size-4 animate-spin' />
                    </>
                  ) : (
                    'Admit patient'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className='dashboard-card overflow-hidden rounded-[30px] border-border'>
            <CardHeader className='gap-4 border-b border-slate-200/70 pb-6'>
              <div className='flex flex-wrap items-start gap-4'>
                <div className='flex size-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 shadow-sm'>
                  <BedDouble className='size-5' />
                </div>
                <div className='min-w-0 flex-1 space-y-2'>
                  <CardTitle className='text-xl'>Bed workflow</CardTitle>
                  <p className='max-w-2xl text-sm leading-6 text-muted-foreground'>
                    Use the current admission and occupancy versions from the live board before
                    assigning, transferring, or discharging.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className='space-y-5 p-5 lg:p-6'>
              <div className='grid gap-4 md:grid-cols-2'>
                <Field label='Admission ID'>
                  <Input
                    data-testid='ipd-admission-id-input'
                    onChange={(event) => {
                      resetActionState();
                      setWorkflowFormState((current) => ({ ...current, admissionId: event.target.value }));
                      setSelectedAdmissionId(event.target.value.trim() ? event.target.value.trim() : null);
                    }}
                    placeholder='admission-123'
                    value={workflowFormState.admissionId}
                  />
                </Field>
                <Field label='Admission version'>
                  <Input
                    data-testid='ipd-admission-version-input'
                    onChange={(event) => {
                      resetActionState();
                      setWorkflowFormState((current) => ({ ...current, expectedAdmissionVersion: event.target.value }));
                    }}
                    placeholder='1'
                    type='number'
                    value={workflowFormState.expectedAdmissionVersion}
                  />
                </Field>
                <Field label='Current occupancy version'>
                  <Input
                    data-testid='ipd-occupancy-version-input'
                    onChange={(event) => {
                      resetActionState();
                      setWorkflowFormState((current) => ({ ...current, expectedOccupancyVersion: event.target.value }));
                    }}
                    placeholder='1'
                    type='number'
                    value={workflowFormState.expectedOccupancyVersion}
                  />
                </Field>
                <Field label='Assign bed ID'>
                  <Input
                    data-testid='ipd-bed-id-input'
                    onChange={(event) => {
                      resetActionState();
                      setWorkflowFormState((current) => ({ ...current, bedId: event.target.value }));
                    }}
                    placeholder='bed-a1'
                    value={workflowFormState.bedId}
                  />
                </Field>
                <Field label='Transfer target bed ID'>
                  <Input
                    data-testid='ipd-target-bed-id-input'
                    onChange={(event) => {
                      resetActionState();
                      setWorkflowFormState((current) => ({ ...current, targetBedId: event.target.value }));
                    }}
                    placeholder='bed-b2'
                    value={workflowFormState.targetBedId}
                  />
                </Field>
              </div>

              <Field label='Movement note'>
                <textarea
                  className='focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'
                  data-testid='ipd-movement-note-input'
                  onChange={(event) => {
                    resetActionState();
                    setWorkflowFormState((current) => ({ ...current, movementNote: event.target.value }));
                  }}
                  placeholder='Bed handoff, transfer rationale, or discharge note'
                  value={workflowFormState.movementNote}
                />
              </Field>

              <Field label='Discharge notes'>
                <textarea
                  className='focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-xs outline-none focus-visible:ring-[3px]'
                  data-testid='ipd-discharge-notes-input'
                  onChange={(event) => {
                    resetActionState();
                    setWorkflowFormState((current) => ({ ...current, dischargeNotes: event.target.value }));
                  }}
                  placeholder='Clinical or reception discharge summary'
                  value={workflowFormState.dischargeNotes}
                />
              </Field>

              <div className='grid gap-3 sm:grid-cols-3'>
                <Button
                  className='h-11 rounded-xl px-5'
                  data-testid='ipd-assign-submit-button'
                  disabled={
                    activeMutationIsPending() ||
                    workflowFormState.admissionId.trim().length === 0 ||
                    workflowFormState.bedId.trim().length === 0 ||
                    workflowFormState.expectedAdmissionVersion.trim().length === 0
                  }
                  onClick={() => {
                    void handleAssign();
                  }}
                  type='button'
                  variant='outline'
                >
                  {assignMutation.isPending ? 'Assigning...' : 'Assign bed'}
                </Button>
                <Button
                  className='h-11 rounded-xl px-5'
                  data-testid='ipd-transfer-submit-button'
                  disabled={
                    activeMutationIsPending() ||
                    workflowFormState.admissionId.trim().length === 0 ||
                    workflowFormState.targetBedId.trim().length === 0 ||
                    workflowFormState.expectedAdmissionVersion.trim().length === 0 ||
                    workflowFormState.expectedOccupancyVersion.trim().length === 0
                  }
                  onClick={() => {
                    void handleTransfer();
                  }}
                  type='button'
                  variant='outline'
                >
                  {transferMutation.isPending ? 'Transferring...' : 'Transfer bed'}
                </Button>
                <Button
                  className='h-11 rounded-xl px-5'
                  data-testid='ipd-discharge-submit-button'
                  disabled={
                    activeMutationIsPending() ||
                    workflowFormState.admissionId.trim().length === 0 ||
                    workflowFormState.expectedAdmissionVersion.trim().length === 0
                  }
                  onClick={() => {
                    void handleDischarge();
                  }}
                  type='button'
                  variant='outline'
                >
                  {dischargeMutation.isPending ? 'Discharging...' : 'Discharge'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className='dashboard-card rounded-[30px] border-border'>
            <CardHeader className='gap-2 pb-4'>
              <CardTitle className='text-lg'>Live occupancy board</CardTitle>
              <p className='text-sm leading-6 text-muted-foreground'>
                Select an occupied bed to hydrate the active admission workspace and inspect its
                movement history.
              </p>
            </CardHeader>
            <CardContent>
              {occupancy.length === 0 ? (
                <Alert className='rounded-2xl border-slate-200 bg-slate-50/80 text-slate-950' data-testid='reception-inpatients-occupancy-empty-state'>
                  <TriangleAlert className='size-4' />
                  <AlertTitle>No occupied beds yet</AlertTitle>
                  <AlertDescription>
                    The occupancy board is empty, but the inpatient workflow remains live for new
                    admissions and subsequent bed actions.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className='space-y-3' data-testid='reception-inpatients-occupancy-list'>
                  {occupancy.map((entry) => {
                    const isSelected = selectedAdmissionId === entry.admission.id;

                    return (
                      <button
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          isSelected
                            ? 'border-cyan-300 bg-cyan-50/80 text-cyan-950'
                            : 'border-slate-200/70 bg-white/80 text-slate-950 hover:border-cyan-200 hover:bg-cyan-50/40'
                        }`}
                        data-admission-version={String(entry.admission.version)}
                        data-bed-id={entry.bed.id}
                        data-occupancy-version={String(entry.version)}
                        data-testid={`reception-inpatients-occupancy-row-${entry.id}`}
                        key={entry.id}
                        onClick={() => {
                          resetActionState();
                          hydrateWorkflowFromOccupancy(entry);
                          setSelectedAdmissionId(entry.admission.id);
                        }}
                        type='button'
                      >
                        <div className='flex flex-wrap items-center justify-between gap-3'>
                          <div>
                            <p className='font-semibold'>{entry.admission.patient.fullName}</p>
                            <p className='mt-1 text-sm text-slate-500'>
                              {entry.admission.patient.registrationNumber} • {entry.bed.wardName} / room {entry.bed.roomNumber}
                            </p>
                          </div>
                          <Badge className='rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700' variant='outline'>
                            Bed {entry.bed.bedNumber}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className='space-y-6'>
          <SchedulingStateCard
            code={actionState.code}
            description={actionState.description}
            diagnostics={actionState.diagnostics}
            icon={renderStateIcon(actionState.status)}
            metadata={{
              'data-selected-admission-id': workflowFormState.admissionId || undefined,
              'data-selected-admission-version': workflowFormState.expectedAdmissionVersion || undefined,
              'data-selected-occupancy-version': workflowFormState.expectedOccupancyVersion || undefined,
            }}
            status={actionState.status}
            testId={actionState.testId}
            title={actionState.title}
            tone={stateTone(actionState.status)}
          />

          <Card className='dashboard-card rounded-[30px] border-border'>
            <CardHeader className='gap-2 pb-4'>
              <CardTitle className='text-lg'>Movement history</CardTitle>
              <p className='text-sm leading-6 text-muted-foreground'>
                Inspect the authoritative history for the selected admission instead of inferring bed
                state from stale UI memory.
              </p>
            </CardHeader>
            <CardContent>
              {!selectedAdmissionId ? (
                <Alert className='rounded-2xl border-slate-200 bg-slate-50/80 text-slate-950' data-testid='reception-inpatients-history-idle-state'>
                  <TriangleAlert className='size-4' />
                  <AlertTitle>Select or create an admission</AlertTitle>
                  <AlertDescription>
                    Choose an occupied bed or complete an admission workflow to inspect movement
                    history.
                  </AlertDescription>
                </Alert>
              ) : movementsQuery.isPending ? (
                <Alert className='rounded-2xl border-cyan-200 bg-cyan-50/70 text-cyan-950' data-testid='reception-inpatients-history-loading-state'>
                  <LoaderCircle className='size-4 animate-spin' />
                  <AlertTitle>Loading movement history</AlertTitle>
                  <AlertDescription>
                    Requesting the live admission movement history before rendering transfer or
                    discharge evidence.
                  </AlertDescription>
                </Alert>
              ) : movementsQuery.isError ? (
                <Alert
                  className='rounded-2xl border-slate-200 bg-slate-50/80 text-slate-950'
                  data-screen-code={movementsErrorCode}
                  data-screen-status='unavailable'
                  data-testid='reception-inpatients-history-unavailable-state'
                >
                  <TriangleAlert className='size-4' />
                  <AlertTitle>Movement history unavailable</AlertTitle>
                  <AlertDescription>
                    The movement history contract could not be verified, so the screen stayed fail
                    closed.
                  </AlertDescription>
                </Alert>
              ) : movementsQuery.data && movementsQuery.data.length > 0 ? (
                <div className='space-y-3' data-testid='reception-inpatients-history-list'>
                  {movementsQuery.data.map((movement) => (
                    <div
                      className='rounded-2xl border border-slate-200/70 bg-white/80 p-4'
                      data-movement-type={movement.movementType}
                      data-testid={`reception-inpatients-history-row-${movement.id}`}
                      key={movement.id}
                    >
                      <div className='flex flex-wrap items-center justify-between gap-3'>
                        <p className='font-semibold text-slate-950'>{movement.movementType}</p>
                        <Badge className='rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700' variant='outline'>
                          {movement.toBed?.bedNumber ?? 'No bed'}
                        </Badge>
                      </div>
                      <p className='mt-2 text-sm text-slate-500'>
                        {movement.movedByUser.username} • {movement.note ?? 'No movement note'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert className='rounded-2xl border-slate-200 bg-slate-50/80 text-slate-950' data-testid='reception-inpatients-history-empty-state'>
                  <TriangleAlert className='size-4' />
                  <AlertTitle>No movements recorded yet</AlertTitle>
                  <AlertDescription>
                    This admission has no recorded movements yet, so transfer and discharge evidence
                    remains empty but explicit.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card className='dashboard-card rounded-[30px] border-border'>
            <CardHeader className='gap-2 pb-4'>
              <CardTitle className='text-lg'>Workflow guarantees</CardTitle>
              <p className='text-sm leading-6 text-muted-foreground'>
                The receptionist flow stays truthful to the live IPD contract instead of fabricating
                occupancy success.
              </p>
            </CardHeader>
            <CardContent className='space-y-4 text-sm leading-6 text-muted-foreground'>
              <p data-testid='reception-inpatients-conflict-note'>
                Conflict outcomes preserve the backend
                <code className='mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-900'>error.code</code>
                so future agents can distinguish lifecycle races from generic outages.
              </p>
              <ul className='space-y-3'>
                <li>• Occupancy remains sourced from the authoritative Node API.</li>
                <li>• Bed transfers and discharge require rendered optimistic-lock versions.</li>
                <li>• Movement history surfaces stay explicit even when the contract degrades.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );

  function activeMutationIsPending() {
    return (
      admitMutation.isPending ||
      assignMutation.isPending ||
      transferMutation.isPending ||
      dischargeMutation.isPending
    );
  }

  function resetActionState() {
    setActionState(createInitialInpatientsActionState());
  }

  function hydrateWorkflowFromAdmission(admission: IpdAdmission) {
    setWorkflowFormState((current) => ({
      ...current,
      admissionId: admission.id,
      expectedAdmissionVersion: String(admission.version),
      expectedOccupancyVersion: admission.currentBedOccupancy
        ? String(admission.currentBedOccupancy.version)
        : '',
    }));
  }

  function hydrateWorkflowFromOccupancy(entry: IpdOccupancyEntry) {
    setWorkflowFormState((current) => ({
      ...current,
      admissionId: entry.admission.id,
      expectedAdmissionVersion: String(entry.admission.version),
      expectedOccupancyVersion: String(entry.version),
    }));
  }

  async function handleAdmit() {
    setActionState(createPendingInpatientsActionState('admission'));

    try {
      const admission = await admitMutation.mutateAsync({
        attendingDoctorUserId: optionalString(admitFormState.attendingDoctorUserId),
        notes: optionalString(admitFormState.notes),
        patientId: admitFormState.patientId.trim(),
      });

      setSelectedAdmissionId(admission.id);
      hydrateWorkflowFromAdmission(admission);
      setActionState(
        createSuccessInpatientsActionState({
          admission,
          kind: 'admission',
          movement: null,
        }),
      );
    } catch (error) {
      setActionState(createFailedInpatientsActionState('admission', error));
    }
  }

  async function handleAssign() {
    const expectedAdmissionVersion = Number.parseInt(workflowFormState.expectedAdmissionVersion, 10);
    if (!Number.isInteger(expectedAdmissionVersion)) {
      return;
    }

    setActionState(createPendingInpatientsActionState('assignment'));

    try {
      const result = await assignMutation.mutateAsync({
        admissionId: workflowFormState.admissionId.trim(),
        bedId: workflowFormState.bedId.trim(),
        expectedAdmissionVersion,
        note: optionalString(workflowFormState.movementNote),
      });

      setSelectedAdmissionId(result.admission.id);
      hydrateWorkflowFromAdmission(result.admission);
      await queryClient.invalidateQueries({ queryKey: ipdMovementsQueryKey(result.admission.id) });
      setActionState(
        createSuccessInpatientsActionState({
          admission: result.admission,
          kind: 'assignment',
          movement: result.movement,
        }),
      );
    } catch (error) {
      setActionState(createFailedInpatientsActionState('assignment', error));
    }
  }

  async function handleTransfer() {
    const expectedAdmissionVersion = Number.parseInt(workflowFormState.expectedAdmissionVersion, 10);
    const expectedOccupancyVersion = Number.parseInt(workflowFormState.expectedOccupancyVersion, 10);
    if (!Number.isInteger(expectedAdmissionVersion) || !Number.isInteger(expectedOccupancyVersion)) {
      return;
    }

    setActionState(createPendingInpatientsActionState('transfer'));

    try {
      const result = await transferMutation.mutateAsync({
        admissionId: workflowFormState.admissionId.trim(),
        expectedAdmissionVersion,
        expectedOccupancyVersion,
        note: optionalString(workflowFormState.movementNote),
        targetBedId: workflowFormState.targetBedId.trim(),
      });

      setSelectedAdmissionId(result.admission.id);
      hydrateWorkflowFromAdmission(result.admission);
      setActionState(
        createSuccessInpatientsActionState({
          admission: result.admission,
          kind: 'transfer',
          movement: result.movement,
        }),
      );
    } catch (error) {
      setActionState(createFailedInpatientsActionState('transfer', error));
    }
  }

  async function handleDischarge() {
    const expectedAdmissionVersion = Number.parseInt(workflowFormState.expectedAdmissionVersion, 10);
    if (!Number.isInteger(expectedAdmissionVersion)) {
      return;
    }

    const expectedOccupancyVersion = workflowFormState.expectedOccupancyVersion.trim()
      ? Number.parseInt(workflowFormState.expectedOccupancyVersion, 10)
      : undefined;

    setActionState(createPendingInpatientsActionState('discharge'));

    try {
      const result = await dischargeMutation.mutateAsync({
        admissionId: workflowFormState.admissionId.trim(),
        dischargeNotes: optionalString(workflowFormState.dischargeNotes),
        expectedAdmissionVersion,
        expectedOccupancyVersion,
        movementNote: optionalString(workflowFormState.movementNote),
      });

      setSelectedAdmissionId(result.admission.id);
      hydrateWorkflowFromAdmission(result.admission);
      setActionState(
        createSuccessInpatientsActionState({
          admission: result.admission,
          kind: 'discharge',
          movement: result.movement,
        }),
      );
    } catch (error) {
      setActionState(createFailedInpatientsActionState('discharge', error));
    }
  }
}

function Field(props: { children: React.ReactNode; label: string }) {
  return (
    <label className='space-y-2'>
      <span className='text-sm font-medium text-slate-700'>{props.label}</span>
      {props.children}
    </label>
  );
}

function renderStateIcon(status: string) {
  if (status === 'pending') {
    return <LoaderCircle className='size-5 animate-spin' />;
  }

  if (status === 'success') {
    return <CheckCircle2 className='size-5' />;
  }

  if (status === 'forbidden') {
    return <ShieldAlert className='size-5' />;
  }

  if (status === 'conflict') {
    return <CircleAlert className='size-5' />;
  }

  if (status === 'unavailable') {
    return <TriangleAlert className='size-5' />;
  }

  return <BedDouble className='size-5' />;
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

  if (status === 'unavailable') {
    return 'border-slate-200 bg-slate-50/80 text-slate-950';
  }

  return 'border-cyan-200 bg-cyan-50/70 text-cyan-950';
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
