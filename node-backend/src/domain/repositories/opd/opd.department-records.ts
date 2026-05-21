import prismaClientPkg, { type UserRole as UserRoleType } from '@prisma/client/index';

const { UserRole } = prismaClientPkg;

import type {
  DepartmentAssignmentDoctorRecord,
  DepartmentRecord,
} from './opd.types.js';

export const departmentWithAssignmentSelect = {
  id: true,
  name: true,
  assignedDoctorUserId: true,
  createdAt: true,
  updatedAt: true,
  assignedDoctor: {
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
    },
  },
} as const;

const validateDepartmentDoctor = (
  doctor: DepartmentAssignmentDoctorRecord | null,
  context: string,
): DepartmentAssignmentDoctorRecord | null => {
  if (!doctor) {
    return null;
  }

  if (
    typeof doctor.id !== 'string' ||
    typeof doctor.username !== 'string' ||
    doctor.role !== UserRole.DOCTOR ||
    typeof doctor.isActive !== 'boolean'
  ) {
    throw new Error(`${context} returned malformed assigned doctor principal`);
  }

  return doctor;
};

export const validateDepartmentRecord = (
  department: DepartmentRecord | null,
  context: string,
): DepartmentRecord | null => {
  if (!department) {
    return null;
  }

  if (
    typeof department.id !== 'string' ||
    typeof department.name !== 'string' ||
    !(department.createdAt instanceof Date) ||
    !(department.updatedAt instanceof Date)
  ) {
    throw new Error(`${context} returned malformed department record`);
  }

  const assignedDoctor = validateDepartmentDoctor(
    department.assignedDoctor,
    context,
  );

  if (department.assignedDoctorUserId === null) {
    if (assignedDoctor !== null) {
      throw new Error(`${context} returned unexpected assigned doctor relation`);
    }

    return {
      ...department,
      assignedDoctor,
    };
  }

  if (
    typeof department.assignedDoctorUserId !== 'string' ||
    assignedDoctor === null
  ) {
    throw new Error(`${context} returned malformed assignment relation`);
  }

  if (department.assignedDoctorUserId !== assignedDoctor.id) {
    throw new Error(`${context} returned mismatched assigned doctor relation`);
  }

  return {
    ...department,
    assignedDoctor,
  };
};

export const requireDepartmentRecord = (
  department: DepartmentRecord | null,
  context: string,
): DepartmentRecord => {
  const validatedDepartment = validateDepartmentRecord(department, context);
  if (!validatedDepartment) {
    throw new Error(`${context} returned no department record`);
  }

  return validatedDepartment;
};
