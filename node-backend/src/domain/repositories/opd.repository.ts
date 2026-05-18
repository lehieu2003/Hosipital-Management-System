import {
  AppointmentStatus,
  UserRole,
  type Appointment,
  type Patient,
  type PatientGender,
  type Prisma,
  type User,
} from '@prisma/client';

import { db } from '../../infrastructure/database/client.js';
import { ERROR_CODES } from '../../shared/constants/error-codes.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/utils/logger.js';

export type CreatePatientRecordInput = {
  fullName: string;
  primaryPhone: string;
  email?: string;
  dateOfBirth?: Date;
  gender?: PatientGender;
  address?: string;
  createdByUserId: string;
};

export type CreateDepartmentRecordInput = {
  name: string;
};

export type AssignDepartmentDoctorRecordInput = {
  departmentId: string;
  doctorUserId: string;
};

export type CreateAppointmentRecordInput = {
  patientId: string;
  doctorUserId: string;
  scheduledAt: Date;
  durationMinutes?: number;
  notes?: string | null;
};

export type UpdateAppointmentRecordInput = {
  appointmentId: string;
  expectedVersion: number;
  ownedByDoctorUserId?: string;
  doctorUserId?: string;
  scheduledAt?: Date;
  durationMinutes?: number;
  status?: AppointmentStatus;
  notes?: string | null;
};

export type DepartmentAssignmentDoctorRecord = Pick<User, 'id' | 'username' | 'role' | 'isActive'>;

export type DepartmentRecord = {
  id: string;
  name: string;
  assignedDoctorUserId: string | null;
  assignedDoctor: DepartmentAssignmentDoctorRecord | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AssignedDoctorDirectoryRecord = {
  departmentId: string;
  departmentName: string;
  doctor: DepartmentAssignmentDoctorRecord;
};

const ACTIVE_DOCTOR_QUEUE_STATUSES = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CHECKED_IN,
] as const;

const wrapOpdStoreError = (
  action: string,
  error: unknown,
  metadata?: Record<string, unknown>,
): never => {
  if (error instanceof AppError) {
    throw error;
  }

  logger.error(
    {
      action,
      ...(metadata ?? {}),
      error,
    },
    'opd_repository_failed',
  );

  throw new AppError(
    'OPD persistence is temporarily unavailable',
    503,
    ERROR_CODES.opdUnavailable,
  );
};

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

const validateDepartmentRecord = (
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

  const assignedDoctor = validateDepartmentDoctor(department.assignedDoctor, context);

  if (department.assignedDoctorUserId === null) {
    if (assignedDoctor !== null) {
      throw new Error(`${context} returned unexpected assigned doctor relation`);
    }

    return {
      ...department,
      assignedDoctor,
    };
  }

  if (typeof department.assignedDoctorUserId !== 'string' || assignedDoctor === null) {
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

const requireDepartmentRecord = (
  department: DepartmentRecord | null,
  context: string,
): DepartmentRecord => {
  const validatedDepartment = validateDepartmentRecord(department, context);
  if (!validatedDepartment) {
    throw new Error(`${context} returned no department record`);
  }

  return validatedDepartment;
};

const departmentWithAssignmentSelect = {
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

class OpdRepository {
  async createPatient(data: CreatePatientRecordInput) {
    try {
      return await db.patient.create({
        data,
      });
    } catch (error) {
      return wrapOpdStoreError('create_patient', error, {
        actorUserId: data.createdByUserId,
      });
    }
  }

  async createDepartment(data: CreateDepartmentRecordInput) {
    try {
      const department = await db.department.create({
        data,
        select: departmentWithAssignmentSelect,
      });

      return requireDepartmentRecord(department, 'create_department');
    } catch (error) {
      return wrapOpdStoreError('create_department', error, {
        departmentName: data.name,
      });
    }
  }

  async findPatientById(id: string) {
    try {
      return await db.patient.findUnique({
        where: { id },
      });
    } catch (error) {
      return wrapOpdStoreError('find_patient_by_id', error, {
        patientId: id,
      });
    }
  }

  async findUserById(id: string) {
    try {
      return await db.user.findUnique({
        where: { id },
      });
    } catch (error) {
      return wrapOpdStoreError('find_user_by_id', error, {
        userId: id,
      });
    }
  }

  async findDepartmentById(id: string) {
    try {
      const department = await db.department.findUnique({
        where: { id },
        select: departmentWithAssignmentSelect,
      });

      return validateDepartmentRecord(department, 'find_department_by_id');
    } catch (error) {
      return wrapOpdStoreError('find_department_by_id', error, {
        departmentId: id,
      });
    }
  }

  async findDepartmentByName(name: string) {
    try {
      const department = await db.department.findUnique({
        where: { name },
        select: departmentWithAssignmentSelect,
      });

      return validateDepartmentRecord(department, 'find_department_by_name');
    } catch (error) {
      return wrapOpdStoreError('find_department_by_name', error, {
        departmentName: name,
      });
    }
  }

  async listDepartmentsWithAssignments() {
    try {
      const departments = await db.department.findMany({
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: departmentWithAssignmentSelect,
      });

      if (!Array.isArray(departments)) {
        throw new Error('Department list returned malformed payload');
      }

      return departments.map((department) =>
        requireDepartmentRecord(department, 'list_departments_with_assignments'),
      );
    } catch (error) {
      return wrapOpdStoreError('list_departments_with_assignments', error);
    }
  }

  async assignDoctorToDepartment({ departmentId, doctorUserId }: AssignDepartmentDoctorRecordInput) {
    try {
      return await db.$transaction(async (tx) => {
        await tx.department.updateMany({
          where: {
            assignedDoctorUserId: doctorUserId,
            NOT: {
              id: departmentId,
            },
          },
          data: {
            assignedDoctorUserId: null,
          },
        });

        const department = await tx.department.update({
          where: { id: departmentId },
          data: {
            assignedDoctorUserId: doctorUserId,
          },
          select: departmentWithAssignmentSelect,
        });

        return requireDepartmentRecord(department, 'assign_doctor_to_department');
      });
    } catch (error) {
      return wrapOpdStoreError('assign_doctor_to_department', error, {
        departmentId,
        doctorUserId,
      });
    }
  }

  async findAssignedDoctorDirectory() {
    try {
      const departments = await db.department.findMany({
        where: {
          assignedDoctorUserId: {
            not: null,
          },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: departmentWithAssignmentSelect,
      });

      if (!Array.isArray(departments)) {
        throw new Error('Doctor directory lookup returned malformed payload');
      }

      return departments.map((department) => {
        const validatedDepartment = validateDepartmentRecord(
          department,
          'find_assigned_doctor_directory',
        );

        if (!validatedDepartment?.assignedDoctor || validatedDepartment.assignedDoctor.isActive !== true) {
          throw new Error('Doctor directory lookup returned malformed assigned doctor state');
        }

        return {
          departmentId: validatedDepartment.id,
          departmentName: validatedDepartment.name,
          doctor: validatedDepartment.assignedDoctor,
        };
      });
    } catch (error) {
      return wrapOpdStoreError('find_assigned_doctor_directory', error);
    }
  }

  async createAppointment(data: CreateAppointmentRecordInput) {
    try {
      return await db.appointment.create({
        data,
      });
    } catch (error) {
      return wrapOpdStoreError('create_appointment', error, {
        patientId: data.patientId,
        doctorUserId: data.doctorUserId,
      });
    }
  }

  async findAppointmentById(id: string) {
    try {
      return await db.appointment.findUnique({
        where: { id },
      });
    } catch (error) {
      return wrapOpdStoreError('find_appointment_by_id', error, {
        appointmentId: id,
      });
    }
  }

  async findAppointmentWithPatientById(id: string) {
    try {
      const appointment = await db.appointment.findUnique({
        where: { id },
        include: {
          patient: true,
        },
      });

      if (appointment && !appointment.patient) {
        throw new Error('Appointment lookup returned malformed patient relation');
      }

      return appointment;
    } catch (error) {
      return wrapOpdStoreError('find_appointment_with_patient_by_id', error, {
        appointmentId: id,
      });
    }
  }

  async findActiveQueueByDoctorUserId(doctorUserId: string) {
    try {
      const appointments = await db.appointment.findMany({
        where: {
          doctorUserId,
          status: {
            in: [...ACTIVE_DOCTOR_QUEUE_STATUSES],
          },
        },
        orderBy: [
          { scheduledAt: 'asc' },
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
        include: {
          patient: true,
        },
      });

      if (!Array.isArray(appointments)) {
        throw new Error('Doctor queue lookup returned malformed payload');
      }

      for (const appointment of appointments) {
        if (!appointment.patient) {
          throw new Error('Doctor queue lookup returned malformed patient relation');
        }
      }

      return appointments;
    } catch (error) {
      return wrapOpdStoreError('find_active_queue_by_doctor_user_id', error, {
        doctorUserId,
        activeStatuses: ACTIVE_DOCTOR_QUEUE_STATUSES,
      });
    }
  }

  async updateAppointmentWithVersion({
    appointmentId,
    expectedVersion,
    ownedByDoctorUserId,
    doctorUserId,
    scheduledAt,
    durationMinutes,
    status,
    notes,
  }: UpdateAppointmentRecordInput) {
    try {
      return await db.$transaction(async (tx) => {
        const updateData: {
          doctorUserId?: string;
          scheduledAt?: Date;
          durationMinutes?: number;
          status?: AppointmentStatus;
          notes?: string | null;
          version: { increment: number };
        } = {
          version: { increment: 1 },
        };

        if (doctorUserId !== undefined) {
          updateData.doctorUserId = doctorUserId;
        }

        if (scheduledAt !== undefined) {
          updateData.scheduledAt = scheduledAt;
        }

        if (durationMinutes !== undefined) {
          updateData.durationMinutes = durationMinutes;
        }

        if (status !== undefined) {
          updateData.status = status;
        }

        if (notes !== undefined) {
          updateData.notes = notes;
        }

        const result = await tx.appointment.updateMany({
          where: {
            id: appointmentId,
            version: expectedVersion,
            ...(ownedByDoctorUserId !== undefined ? { doctorUserId: ownedByDoctorUserId } : {}),
          },
          data: updateData,
        });

        if (result.count === 0) {
          return null;
        }

        const updatedAppointment = await tx.appointment.findUnique({
          where: { id: appointmentId },
        });

        if (!updatedAppointment) {
          throw new Error('Appointment update returned no row after successful write');
        }

        return updatedAppointment;
      });
    } catch (error) {
      return wrapOpdStoreError('update_appointment_with_version', error, {
        appointmentId,
        expectedVersion,
        ownedByDoctorUserId,
      });
    }
  }
}

export const opdRepository = new OpdRepository();
export type OpdPatientRecord = Patient;
export type OpdUserRecord = User;
export type OpdAppointmentRecord = Appointment;
export type OpdDoctorQueueRecord = Prisma.AppointmentGetPayload<{
  include: {
    patient: true;
  };
}>;
export type OpdDepartmentRecord = DepartmentRecord;
export type OpdAssignedDoctorDirectoryRecord = AssignedDoctorDirectoryRecord;
export type OpdDoctorDirectoryRecord = DepartmentAssignmentDoctorRecord;
