import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { ApiError, createApiClient } from '@/lib/api/client';

import {
  listDoctorQueue,
  shouldRecoverDoctorQueue,
  updateDoctorQueueAppointment,
  type DoctorQueueAppointment,
  type QueueLifecycleAppointment,
  type UpdateDoctorQueueAppointmentInput,
} from './api';

export const DOCTOR_QUEUE_QUERY_KEY = ['doctor-queue'] as const;
export const DOCTOR_QUEUE_REFETCH_INTERVAL_MS = 15_000;

type QueueBoundaryStatus = 'ready' | 'empty' | 'forbidden' | 'unavailable';
type QueueActionStatus = 'idle' | 'pending' | 'success' | 'forbidden' | 'conflict' | 'unavailable';

export type QueueBoundaryState = {
  status: QueueBoundaryStatus;
  code: string;
  title: string;
  description: string;
  diagnostics: string[];
};

export type QueueActionState = {
  testId: string;
  status: QueueActionStatus;
  code: string;
  title: string;
  description: string;
  diagnostics: string[];
};

export function useDoctorQueueQuery() {
  const { sessionManager } = useAuth();
  const client = useMemo(() => createApiClient({ sessionManager }), [sessionManager]);

  return useQuery({
    queryFn: () => listDoctorQueue(client),
    queryKey: DOCTOR_QUEUE_QUERY_KEY,
    retry: false,
    refetchInterval: DOCTOR_QUEUE_REFETCH_INTERVAL_MS,
  });
}

export function useUpdateDoctorQueueAppointmentMutation() {
  const { sessionManager } = useAuth();
  const queryClient = useQueryClient();
  const client = useMemo(() => createApiClient({ sessionManager }), [sessionManager]);

  return useMutation<QueueLifecycleAppointment, ApiError, UpdateDoctorQueueAppointmentInput>({
    mutationFn: (input) => updateDoctorQueueAppointment(client, input),
    onError: (error) => {
      if (shouldRecoverDoctorQueue(error)) {
        void queryClient.invalidateQueries({
          exact: true,
          queryKey: DOCTOR_QUEUE_QUERY_KEY,
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        exact: true,
        queryKey: DOCTOR_QUEUE_QUERY_KEY,
      });
    },
  });
}

export function resolveDoctorQueueBoundaryState(
  appointments: DoctorQueueAppointment[] | undefined,
  error: unknown,
): QueueBoundaryState {
  if (error instanceof ApiError) {
    if (error.code === 'FORBIDDEN') {
      return {
        status: 'forbidden',
        code: 'FORBIDDEN',
        title: 'Doctor queue blocked',
        description:
          'Your account is authenticated but the live doctor queue contract denied access.',
        diagnostics: [
          'Role boundary rejected doctor queue access.',
          'The screen stays fail closed and does not render stale queue items.',
        ],
      };
    }

    return {
      status: 'unavailable',
      code: 'UNAVAILABLE',
      title: 'Doctor queue unavailable',
      description:
        'The live queue could not be verified, so the doctor workspace stays fail closed.',
      diagnostics: [
        `Last API error code: ${error.code}`,
        'Retry after the queue contract recovers or auth replay succeeds.',
      ],
    };
  }

  if (!appointments || appointments.length === 0) {
    return {
      status: 'empty',
      code: 'EMPTY_QUEUE',
      title: 'No active patients in queue',
      description:
        'The backend returned an empty active queue, so there is no next patient to progress right now.',
      diagnostics: [
        'Queue lookup succeeded and returned zero SCHEDULED/CHECKED_IN appointments.',
        'Polling and focus refetch remain active for the next arrival.',
      ],
    };
  }

  return {
    status: 'ready',
    code: 'READY',
    title: 'Doctor queue ready',
    description: 'The active queue is live and lifecycle updates are backed by the Node contract.',
    diagnostics: [
      `Loaded ${appointments.length} active appointment${appointments.length === 1 ? '' : 's'}.`,
      `Polling runs every ${DOCTOR_QUEUE_REFETCH_INTERVAL_MS / 1000} seconds while focus refetch stays enabled globally.`,
    ],
  };
}

export function resolveDoctorQueueActionState(args: {
  data: QueueLifecycleAppointment | undefined;
  error: unknown;
  isPending: boolean;
}) : QueueActionState {
  if (args.isPending) {
    return {
      testId: 'doctor-queue-action-pending-state',
      status: 'pending',
      code: 'PENDING',
      title: 'Updating queue status',
      description:
        'Sending a version-guarded lifecycle update to the backend and waiting for the authoritative queue refresh.',
      diagnostics: [
        'Local controls stay pending only until the bounded backend response arrives.',
        'A successful write forces an explicit queue invalidation before the next poll cycle.',
      ],
    };
  }

  if (args.data) {
    const title = args.data.status === 'CHECKED_IN' ? 'Patient checked in' : 'Visit completed';

    return {
      testId: 'doctor-queue-action-success-state',
      status: 'success',
      code: args.data.status,
      title,
      description:
        'The backend accepted the lifecycle update and the queue refetched from the authoritative source.',
      diagnostics: [
        `Appointment version advanced to ${args.data.version}.`,
        `Backend status after mutation: ${args.data.status}.`,
      ],
    };
  }

  if (args.error instanceof ApiError) {
    if (args.error.code === 'FORBIDDEN') {
      return {
        testId: 'doctor-queue-action-forbidden-state',
        status: 'forbidden',
        code: 'FORBIDDEN',
        title: 'Queue action forbidden',
        description:
          'The backend denied this lifecycle update, so the UI stopped without claiming progress.',
        diagnostics: [
          'Queue ownership stays backend authoritative.',
          'No optimistic success state is shown for forbidden responses.',
        ],
      };
    }

    if (
      args.error.code === 'CONFLICT' ||
      args.error.code === 'APPOINTMENT_VERSION_CONFLICT' ||
      args.error.code === 'APPOINTMENT_INVALID_STATUS_TRANSITION' ||
      args.error.code === 'APPOINTMENT_NOT_FOUND'
    ) {
      return {
        testId: 'doctor-queue-action-conflict-state',
        status: 'conflict',
        code: args.error.code,
        title: 'Queue action conflict detected',
        description:
          'The backend rejected the requested lifecycle change because the authoritative appointment state no longer matched the attempted action.',
        diagnostics: [
          `Last API error code: ${args.error.code}`,
          'Refresh the live queue before retrying the next lifecycle step.',
        ],
      };
    }

    return {
      testId: 'doctor-queue-action-unavailable-state',
      status: 'unavailable',
      code: args.error.code,
      title: 'Queue action unavailable',
      description:
        'A backend dependency failed during the lifecycle update, so the queue remained truthful and fail closed.',
      diagnostics: [
        `Last API error code: ${args.error.code}`,
        'Polling and focus refetch stay available for recovery after the failed action.',
      ],
    };
  }

  return {
    testId: 'doctor-queue-action-ready-state',
    status: 'idle',
    code: 'READY',
    title: 'Ready to progress the queue',
    description:
      'Use the live lifecycle controls to check patients in and complete visits against the Node backend.',
    diagnostics: [
      'Every lifecycle action sends the current appointment version.',
      'Mutation success forces an explicit queue invalidation in addition to bounded polling.',
    ],
  };
}
