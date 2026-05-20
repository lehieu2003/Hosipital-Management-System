import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ApiError, createApiClient } from '@/api';
import { useAuth, type UserRole } from '@/features/auth';

export type OperationalScreenId =
  | 'admin-overview'
  | 'doctor-queue'
  | 'reception-inpatients'
  | 'reception-scheduling';
export type OperationalScreenStatus = 'ready' | 'empty' | 'forbidden' | 'conflict' | 'unavailable';
export type OperationalStateCode =
  | 'CONTRACT_PENDING'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'UNAVAILABLE'
  | 'UNKNOWN'
  | string;

export type OperationalFoundation = {
  screenId: OperationalScreenId;
  role: UserRole;
  title: string;
  description: string;
  status: OperationalScreenStatus;
  code: OperationalStateCode;
  capabilities: string[];
  diagnostics: string[];
};

const screenDefinitions: Record<
  OperationalScreenId,
  {
    contractLabel: string;
    description: string;
    endpointPath: string | null;
    role: UserRole;
    title: string;
  }
> = {
  'admin-overview': {
    contractLabel: 'administrative overview',
    description:
      'Operational summary, staffing readiness, and service-level overview remain blocked until the Node adapter lands.',
    endpointPath: null,
    role: 'admin',
    title: 'Admin overview foundation',
  },
  'doctor-queue': {
    contractLabel: 'doctor queue',
    description:
      'Queue polling, patient progression, and consult actions stay blocked until the live Node contract is wired.',
    endpointPath: null,
    role: 'doctor',
    title: 'Doctor queue foundation',
  },
  'reception-scheduling': {
    contractLabel: 'reception scheduling',
    description:
      'Patient search, appointment booking, and slot conflict handling stay blocked until the live Node contract is wired.',
    endpointPath: null,
    role: 'receptionist',
    title: 'Scheduling foundation',
  },
  'reception-inpatients': {
    contractLabel: 'reception inpatient operations',
    description:
      'Inpatient admission, occupancy, bed movement, and discharge actions stay blocked until the live IPD contract is verified.',
    endpointPath: null,
    role: 'receptionist',
    title: 'Inpatient foundation',
  },
};

export async function loadOperationalFoundation(
  screenId: OperationalScreenId,
  client: ReturnType<typeof createApiClient>,
): Promise<OperationalFoundation> {
  const definition = screenDefinitions[screenId];

  if (!definition.endpointPath) {
    return createContractPendingFoundation(screenId);
  }

  try {
    return await client.get<OperationalFoundation>(definition.endpointPath, {
      replayAfterRefresh: true,
    });
  } catch (error) {
    return mapOperationalError(screenId, error);
  }
}

export function useOperationalFoundation(screenId: OperationalScreenId) {
  const { sessionManager } = useAuth();
  const client = useMemo(() => createApiClient({ sessionManager }), [sessionManager]);

  return useQuery({
    queryFn: () => loadOperationalFoundation(screenId, client),
    queryKey: ['operational-foundation', screenId],
    staleTime: 0,
  });
}

export function getScreenDefinition(screenId: OperationalScreenId) {
  return screenDefinitions[screenId];
}

function createContractPendingFoundation(screenId: OperationalScreenId): OperationalFoundation {
  const definition = screenDefinitions[screenId];

  return {
    screenId,
    role: definition.role,
    title: definition.title,
    description: definition.description,
    status: 'unavailable',
    code: 'CONTRACT_PENDING',
    capabilities: buildCapabilities(screenId),
    diagnostics: [
      'The UI is intentionally fail-closed until S15 wires the Node contract.',
      'No placeholder operational metrics are rendered when live data is unavailable.',
      'Stable status and code attributes remain available for tests and future browser verification.',
    ],
  };
}

function mapOperationalError(
  screenId: OperationalScreenId,
  error: unknown,
): OperationalFoundation {
  const definition = screenDefinitions[screenId];

  if (error instanceof ApiError) {
    if (error.code === 'FORBIDDEN') {
      return {
        screenId,
        role: definition.role,
        title: `${definition.title} blocked`,
        description: 'Your account is authenticated but not allowed to open this operational screen.',
        status: 'forbidden',
        code: 'FORBIDDEN',
        capabilities: buildCapabilities(screenId),
        diagnostics: ['Role boundary rejected the request.', 'Verify route role guard and backend authorization alignment.'],
      };
    }

    if (error.code === 'CONFLICT') {
      return {
        screenId,
        role: definition.role,
        title: `${definition.title} conflict`,
        description: 'The backend reported a conflict, so the shell halted instead of showing stale operational data.',
        status: 'conflict',
        code: 'CONFLICT',
        capabilities: buildCapabilities(screenId),
        diagnostics: ['Conflict surfaced at the client boundary.', 'The screen remains blocked until authoritative data can be fetched again.'],
      };
    }

    return {
      screenId,
      role: definition.role,
      title: `${definition.title} unavailable`,
      description: 'The backend request failed, so the shell stayed fail-closed.',
      status: 'unavailable',
      code: 'UNAVAILABLE',
      capabilities: buildCapabilities(screenId),
      diagnostics: [`Last API error code: ${error.code}`, 'Retry after the API contract or upstream dependency recovers.'],
    };
  }

  return {
    screenId,
    role: definition.role,
    title: `${definition.title} unavailable`,
    description: 'The adapter failed before a trustworthy operational state could be rendered.',
    status: 'unavailable',
    code: 'UNKNOWN',
    capabilities: buildCapabilities(screenId),
    diagnostics: ['Unhandled client error reached the adapter boundary.', 'Future contract wiring should preserve this fail-closed surface.'],
  };
}

function buildCapabilities(screenId: OperationalScreenId) {
  if (screenId === 'admin-overview') {
    return [
      'Role-aware administrative shell with explicit unavailable and forbidden states.',
      'Future staffing, throughput, and SLA summaries without fake placeholder metrics.',
      'Stable machine-readable screen status for downstream contract verification.',
    ];
  }

  if (screenId === 'reception-scheduling') {
    return [
      'Patient lookup and appointment booking entrypoint.',
      'Conflict-safe slot selection with explicit conflict and unavailable boundaries.',
      'Stable screen status and diagnostic codes for browser and unit verification.',
    ];
  }

  if (screenId === 'reception-inpatients') {
    return [
      'Reception inpatient admission and bed workflow entrypoint.',
      'Conflict-safe occupancy and movement history boundaries.',
      'Stable screen status and diagnostic codes for browser and unit verification.',
    ];
  }

  return [
    'Doctor-first queue shell for next-patient and consult progression flows.',
    'Refresh-aware queue boundary that halts cleanly on auth or backend degradation.',
    'Stable screen status and diagnostic codes for browser and unit verification.',
  ];
}
