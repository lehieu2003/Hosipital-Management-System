import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  assignDepartmentDoctor,
  createDepartment,
  listAdminDepartments,
  type AdminDepartment,
  type AssignDepartmentDoctorInput,
  type CreateDepartmentInput,
} from '@/api';
import { useAuth } from '@/features/auth';
import { createApiClient, type ApiError } from '@/api';

export const ADMIN_DEPARTMENTS_QUERY_KEY = ['admin', 'config', 'departments'] as const;
const SCHEDULABLE_DOCTORS_QUERY_KEY = ['appointments', 'doctors'] as const;

export function useAdminDepartmentsQuery() {
  const { sessionManager } = useAuth();
  const client = useMemo(() => createApiClient({ sessionManager }), [sessionManager]);

  return useQuery({
    queryFn: () => listAdminDepartments(client),
    queryKey: ADMIN_DEPARTMENTS_QUERY_KEY,
    retry: false,
  });
}

export function useCreateDepartmentMutation() {
  const { sessionManager } = useAuth();
  const client = useMemo(() => createApiClient({ sessionManager }), [sessionManager]);
  const queryClient = useQueryClient();

  return useMutation<AdminDepartment, ApiError, CreateDepartmentInput>({
    mutationFn: (input) => createDepartment(client, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_DEPARTMENTS_QUERY_KEY });
    },
  });
}

export function useAssignDepartmentDoctorMutation() {
  const { sessionManager } = useAuth();
  const client = useMemo(() => createApiClient({ sessionManager }), [sessionManager]);
  const queryClient = useQueryClient();

  return useMutation<AdminDepartment, ApiError, AssignDepartmentDoctorInput>({
    mutationFn: (input) => assignDepartmentDoctor(client, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ADMIN_DEPARTMENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SCHEDULABLE_DOCTORS_QUERY_KEY }),
      ]);
    },
  });
}
