import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth';
import { ApiError, createApiClient } from '@/lib/api/client';

import {
  listSchedulableDoctors,
  scheduleAppointment,
  type ScheduleAppointmentInput,
  type ScheduleAppointmentResult,
  type SchedulableDoctor,
} from './api';

const DOCTOR_DIRECTORY_STALE_TIME_MS = 5 * 60 * 1000;

type SchedulingViewStatus = 'ready' | 'empty' | 'forbidden' | 'conflict' | 'unavailable';

export type SchedulingBoundaryState = {
  status: SchedulingViewStatus;
  code: string;
  title: string;
  description: string;
  diagnostics: string[];
};

export type SchedulingSubmissionState = {
  testId: string;
  status: 'idle' | 'pending' | 'success' | SchedulingViewStatus;
  code: string;
  title: string;
  description: string;
  diagnostics: string[];
};

export function useSchedulableDoctorsQuery() {
  const { sessionManager } = useAuth();
  const client = useMemo(() => createApiClient({ sessionManager }), [sessionManager]);

  return useQuery({
    queryFn: () => listSchedulableDoctors(client),
    queryKey: ['appointments', 'doctors'],
    retry: false,
    staleTime: DOCTOR_DIRECTORY_STALE_TIME_MS,
  });
}

export function useScheduleAppointmentMutation() {
  const { sessionManager } = useAuth();
  const client = useMemo(() => createApiClient({ sessionManager }), [sessionManager]);

  return useMutation<ScheduleAppointmentResult, ApiError, ScheduleAppointmentInput>({
    mutationFn: (input) => scheduleAppointment(client, input),
  });
}

export function resolveSchedulingBoundaryState(
  doctors: SchedulableDoctor[] | undefined,
  error: unknown,
): SchedulingBoundaryState {
  if (error instanceof ApiError) {
    if (error.code === 'FORBIDDEN') {
      return {
        status: 'forbidden',
        code: 'FORBIDDEN',
        title: 'Scheduling workspace blocked',
        description:
          'Your account is authenticated but the live scheduling contract denied access.',
        diagnostics: [
          'Role boundary rejected doctor-directory discovery.',
          'The screen remains fail closed and does not offer manual doctor ID entry.',
        ],
      };
    }

    return {
      status: 'unavailable',
      code: 'UNAVAILABLE',
      title: 'Scheduling workspace unavailable',
      description:
        'The live doctor directory could not be verified, so scheduling stays fail closed.',
      diagnostics: [
        `Last API error code: ${error.code}`,
        'Retry after the doctor directory contract recovers.',
      ],
    };
  }

  if (!doctors || doctors.length === 0) {
    return {
      status: 'empty',
      code: 'NO_DOCTORS_AVAILABLE',
      title: 'No active doctors available',
      description:
        'The Node backend returned an empty doctor directory, so booking remains blocked until schedulable doctor principals exist.',
      diagnostics: [
        'Doctor lookup succeeded but returned zero active doctor principals.',
        'The screen does not fall back to manually typed doctor identifiers.',
      ],
    };
  }

  return {
    status: 'ready',
    code: 'READY',
    title: 'Scheduling contract ready',
    description: 'Doctor discovery is live and the receptionist workflow can register and book patients.',
    diagnostics: [
      `Loaded ${doctors.length} active doctor principal${doctors.length === 1 ? '' : 's'}.`,
      'Patient registration and appointment creation still fail closed on backend errors.',
    ],
  };
}

export function resolveSchedulingSubmissionState(args: {
  data: ScheduleAppointmentResult | undefined;
  error: unknown;
  isPending: boolean;
}): SchedulingSubmissionState {
  if (args.isPending) {
    return {
      testId: 'reception-scheduling-pending-state',
      status: 'pending',
      code: 'SUBMITTING',
      title: 'Submitting booking',
      description:
        'Registering the patient before creating the appointment so partial success cannot be mistaken for a booked visit.',
      diagnostics: [
        'Patient registration runs before appointment creation.',
        'The booking stays pending only until a bounded backend response arrives.',
      ],
    };
  }

  if (args.data) {
    return {
      testId: 'reception-scheduling-success-state',
      status: 'success',
      code: 'SCHEDULED',
      title: 'Appointment scheduled',
      description:
        'The patient registration and appointment booking both completed against the live Node contract.',
      diagnostics: [
        `Patient registration number: ${args.data.patient.registrationNumber}`,
        `Appointment status: ${args.data.appointment.status}`,
      ],
    };
  }

  if (args.error instanceof ApiError) {
    if (args.error.code === 'FORBIDDEN') {
      return {
        testId: 'reception-scheduling-forbidden-state',
        status: 'forbidden',
        code: 'FORBIDDEN',
        title: 'Scheduling action forbidden',
        description:
          'The backend denied this scheduling action, so the UI halted instead of claiming a booking succeeded.',
        diagnostics: [
          'The scheduling mutation preserved the backend FORBIDDEN code.',
          'Refresh replay stays owned by the shared API client boundary.',
        ],
      };
    }

    if (args.error.code === 'CONFLICT') {
      return {
        testId: 'reception-scheduling-conflict-state',
        status: 'conflict',
        code: 'CONFLICT',
        title: 'Scheduling conflict detected',
        description:
          'The backend reported a conflict, so the workflow stopped and kept the screen machine readable.',
        diagnostics: [
          'Retry after the conflicting appointment state is resolved.',
          'No optimistic success state is shown for conflict responses.',
        ],
      };
    }

    if (
      args.error.code === 'DOCTOR_NOT_FOUND' ||
      args.error.code === 'SCHEDULING_TARGET_NOT_DOCTOR'
    ) {
      return {
        testId: 'reception-scheduling-unavailable-state',
        status: 'unavailable',
        code: args.error.code,
        title: 'Scheduling target unavailable',
        description:
          'The selected doctor principal could not satisfy the live scheduling contract, so the booking stayed fail closed.',
        diagnostics: [
          `Last API error code: ${args.error.code}`,
          'Refresh the doctor directory before retrying the booking flow.',
        ],
      };
    }

    return {
      testId: 'reception-scheduling-unavailable-state',
      status: 'unavailable',
      code: args.error.code,
      title: 'Scheduling unavailable',
      description:
        'A backend dependency failed during registration or booking, so the workflow stopped without claiming success.',
      diagnostics: [
        `Last API error code: ${args.error.code}`,
        'Patient registration failures prevent appointment creation from running.',
      ],
    };
  }

  return {
    testId: 'reception-scheduling-ready-state',
    status: 'idle',
    code: 'READY',
    title: 'Ready to schedule',
    description:
      'Select a doctor, register the patient, and book the appointment through the live Node workflow.',
    diagnostics: [
      'The page never asks for a raw doctorUserId.',
      'Success and failure states stay machine readable for browser and Vitest proofs.',
    ],
  };
}
