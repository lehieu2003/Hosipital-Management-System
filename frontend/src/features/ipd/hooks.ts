import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { ApiError, createApiClient } from '@/lib/api/client';

import {
  admitPatient,
  assignBed,
  dischargeAdmission,
  listAdmissionMovements,
  listCurrentOccupancy,
  transferBed,
  type AdmitPatientInput,
  type AssignBedInput,
  type DischargeAdmissionInput,
  type IpdAdmission,
  type IpdAdmissionActionResult,
  type IpdBedMovement,
  type IpdOccupancyEntry,
  type TransferBedInput,
} from './api';

const IPD_OCCUPANCY_STALE_TIME_MS = 30_000;

export const IPD_OCCUPANCY_QUERY_KEY = ['ipd', 'occupancy'] as const;
export const ipdMovementsQueryKey = (admissionId: string) => ['ipd', 'movements', admissionId] as const;

type InpatientsBoundaryStatus = 'ready' | 'forbidden' | 'unavailable';
type InpatientsActionStatus = 'idle' | 'pending' | 'success' | 'forbidden' | 'conflict' | 'unavailable';

type InpatientsActionKind = 'admission' | 'assignment' | 'transfer' | 'discharge';

export type InpatientsBoundaryState = {
  status: InpatientsBoundaryStatus;
  code: string;
  title: string;
  description: string;
  diagnostics: string[];
};

export type InpatientsActionState = {
  status: InpatientsActionStatus;
  code: string;
  title: string;
  description: string;
  diagnostics: string[];
  testId: string;
};

export function useIpdOccupancyQuery() {
  const { sessionManager } = useAuth();
  const client = useMemo(() => createApiClient({ sessionManager }), [sessionManager]);

  return useQuery({
    queryFn: () => listCurrentOccupancy(client),
    queryKey: IPD_OCCUPANCY_QUERY_KEY,
    retry: false,
    staleTime: IPD_OCCUPANCY_STALE_TIME_MS,
  });
}

export function useAdmissionMovementsQuery(admissionId: string | null) {
  const { sessionManager } = useAuth();
  const client = useMemo(() => createApiClient({ sessionManager }), [sessionManager]);
  const normalizedAdmissionId = admissionId?.trim() ?? '';

  return useQuery({
    enabled: normalizedAdmissionId.length > 0,
    queryFn: () => listAdmissionMovements(client, normalizedAdmissionId),
    queryKey: ipdMovementsQueryKey(normalizedAdmissionId),
    retry: false,
    staleTime: 0,
  });
}

export function useAdmitPatientMutation() {
  const { sessionManager } = useAuth();
  const client = useMemo(() => createApiClient({ sessionManager }), [sessionManager]);

  return useMutation<IpdAdmission, ApiError, AdmitPatientInput>({
    mutationFn: (input) => admitPatient(client, input),
  });
}

export function useAssignBedMutation() {
  const { sessionManager } = useAuth();
  const client = useMemo(() => createApiClient({ sessionManager }), [sessionManager]);
  const queryClient = useQueryClient();

  return useMutation<IpdAdmissionActionResult, ApiError, AssignBedInput>({
    mutationFn: (input) => assignBed(client, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: IPD_OCCUPANCY_QUERY_KEY });
    },
  });
}

export function useTransferBedMutation() {
  const { sessionManager } = useAuth();
  const client = useMemo(() => createApiClient({ sessionManager }), [sessionManager]);
  const queryClient = useQueryClient();

  return useMutation<IpdAdmissionActionResult, ApiError, TransferBedInput>({
    mutationFn: (input) => transferBed(client, input),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: IPD_OCCUPANCY_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ipdMovementsQueryKey(result.admission.id) }),
      ]);
    },
  });
}

export function useDischargeAdmissionMutation() {
  const { sessionManager } = useAuth();
  const client = useMemo(() => createApiClient({ sessionManager }), [sessionManager]);
  const queryClient = useQueryClient();

  return useMutation<IpdAdmissionActionResult, ApiError, DischargeAdmissionInput>({
    mutationFn: (input) => dischargeAdmission(client, input),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: IPD_OCCUPANCY_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ipdMovementsQueryKey(result.admission.id) }),
      ]);
    },
  });
}

export function resolveInpatientsBoundaryState(
  occupancy: IpdOccupancyEntry[] | undefined,
  error: unknown,
): InpatientsBoundaryState {
  if (error instanceof ApiError) {
    if (error.code === 'FORBIDDEN') {
      return {
        status: 'forbidden',
        code: 'FORBIDDEN',
        title: 'Inpatient workspace blocked',
        description:
          'Your account is authenticated but the live inpatient contract denied occupancy access.',
        diagnostics: [
          'Role boundary rejected the occupancy lookup.',
          'The screen stays fail closed and does not fabricate current bed or movement state.',
        ],
      };
    }

    return {
      status: 'unavailable',
      code: 'UNAVAILABLE',
      title: 'Inpatient workspace unavailable',
      description:
        'The live occupancy contract could not be verified, so inpatient actions remain fail closed.',
      diagnostics: [
        `Last API error code: ${error.rawCode}`,
        'Retry after the IPD API contract or an upstream dependency recovers.',
      ],
    };
  }

  return {
    status: 'ready',
    code: occupancy && occupancy.length > 0 ? 'OCCUPANCY_LIVE' : 'NO_ACTIVE_OCCUPANCY',
    title: occupancy && occupancy.length > 0 ? 'Inpatient contract ready' : 'No occupied beds yet',
    description:
      occupancy && occupancy.length > 0
        ? 'Current occupancy is live and the receptionist workflow can admit, move, inspect, and discharge inpatients.'
        : 'The occupancy board is currently empty, but the receptionist workflow is live for new admissions and bed actions.',
    diagnostics: [
      `Loaded ${occupancy?.length ?? 0} active occupancy entr${occupancy?.length === 1 ? 'y' : 'ies'} from the live IPD contract.`,
      'Conflict and availability markers stay machine readable for browser and unit verification.',
    ],
  };
}

export function createInitialInpatientsActionState(): InpatientsActionState {
  return {
    testId: 'reception-inpatients-ready-state',
    status: 'idle',
    code: 'READY',
    title: 'Ready for inpatient operations',
    description:
      'Admit a patient, assign or transfer a bed, discharge safely, and inspect movement history through the live IPD workflow.',
    diagnostics: [
      'Occupancy and movement history stay sourced from the authoritative Node API.',
      '409 conflicts surface backend-specific codes instead of collapsing into a fake success state.',
    ],
  };
}

export function createPendingInpatientsActionState(kind: InpatientsActionKind): InpatientsActionState {
  const actionLabel = actionVerb(kind);

  return {
    testId: 'reception-inpatients-pending-state',
    status: 'pending',
    code: 'SUBMITTING',
    title: `${actionLabel} in progress`,
    description: `Waiting for the live IPD contract to finish the ${kind} workflow before any shell state is updated.`,
    diagnostics: [
      'The UI does not render optimistic occupancy or movement history.',
      'Success and failure markers update only after the backend responds.',
    ],
  };
}

export function createSuccessInpatientsActionState(args: {
  admission: IpdAdmission;
  kind: InpatientsActionKind;
  movement: IpdBedMovement | null;
}): InpatientsActionState {
  if (args.kind === 'admission') {
    return {
      testId: 'reception-inpatients-success-state',
      status: 'success',
      code: 'ADMISSION_CREATED',
      title: 'Inpatient admitted',
      description:
        'The live IPD contract created the admission and returned the authoritative version for the next bed action.',
      diagnostics: [
        `Admission id: ${args.admission.id}`,
        `Admission version: ${args.admission.version}`,
      ],
    };
  }

  if (args.kind === 'assignment') {
    return {
      testId: 'reception-inpatients-success-state',
      status: 'success',
      code: 'BED_ASSIGNED',
      title: 'Bed assigned',
      description:
        'The live IPD contract assigned the bed and exposed the authoritative occupancy version for future transfers or discharge.',
      diagnostics: [
        `Current bed: ${args.admission.currentBedOccupancy?.bed.bedNumber ?? 'unknown'}`,
        `Occupancy version: ${args.admission.currentBedOccupancy?.version ?? 'n/a'}`,
      ],
    };
  }

  if (args.kind === 'transfer') {
    return {
      testId: 'reception-inpatients-success-state',
      status: 'success',
      code: 'BED_TRANSFERRED',
      title: 'Bed transferred',
      description:
        'The live IPD contract completed the transfer and returned the new admission and occupancy versions.',
      diagnostics: [
        `Movement id: ${args.movement?.id ?? 'unknown'}`,
        `Current bed: ${args.admission.currentBedOccupancy?.bed.bedNumber ?? 'unknown'}`,
      ],
    };
  }

  return {
    testId: 'reception-inpatients-success-state',
    status: 'success',
    code: 'ADMISSION_DISCHARGED',
    title: 'Inpatient discharged',
    description:
      'The live IPD contract discharged the patient and released the current bed without leaving stale occupancy behind.',
    diagnostics: [
      `Discharge admission version: ${args.admission.version}`,
      `Bed released movement: ${args.movement?.id ?? 'none'}`,
    ],
  };
}

export function createFailedInpatientsActionState(
  kind: InpatientsActionKind,
  error: unknown,
): InpatientsActionState {
  const label = actionVerb(kind);

  if (error instanceof ApiError) {
    if (error.code === 'FORBIDDEN') {
      return {
        testId: 'reception-inpatients-forbidden-state',
        status: 'forbidden',
        code: 'FORBIDDEN',
        title: `${label} forbidden`,
        description:
          'The backend denied this inpatient action, so the UI halted instead of claiming the workflow succeeded.',
        diagnostics: [
          `Last API error code: ${error.rawCode}`,
          'Role and backend authorization remain the source of truth.',
        ],
      };
    }

    if (error.code === 'CONFLICT') {
      return {
        testId: 'reception-inpatients-conflict-state',
        status: 'conflict',
        code: error.rawCode,
        title: `${label} conflict detected`,
        description:
          'The backend reported a lifecycle conflict, so the workspace stayed explicit and machine readable instead of pretending success.',
        diagnostics: [
          `Conflict code: ${error.rawCode}`,
          'Refresh occupancy or history and retry only after the conflicting live state is resolved.',
        ],
      };
    }

    return {
      testId: 'reception-inpatients-unavailable-state',
      status: 'unavailable',
      code: error.rawCode,
      title: `${label} unavailable`,
      description:
        'A backend dependency failed during the inpatient workflow, so the shell stopped without claiming the action completed.',
      diagnostics: [
        `Last API error code: ${error.rawCode}`,
        'Use the occupancy board and movement history to verify current truthful state before retrying.',
      ],
    };
  }

  return {
    testId: 'reception-inpatients-unavailable-state',
    status: 'unavailable',
    code: 'UNAVAILABLE',
    title: `${label} unavailable`,
    description:
      'The inpatient workflow failed before the client could trust the result, so the screen remained fail closed.',
    diagnostics: [
      'An unhandled client error reached the IPD boundary.',
      'No optimistic occupancy or movement history state was rendered.',
    ],
  };
}

function actionVerb(kind: InpatientsActionKind) {
  if (kind === 'admission') {
    return 'Admission';
  }

  if (kind === 'assignment') {
    return 'Bed assignment';
  }

  if (kind === 'transfer') {
    return 'Bed transfer';
  }

  return 'Discharge';
}
