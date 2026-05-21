import prismaClientPkg, { type Appointment, type Patient, type PatientGender, type Prisma, type User, type AppointmentStatus as AppointmentStatusType } from '@prisma/client/index';

const { AppointmentStatus } = prismaClientPkg;

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
  status?: AppointmentStatusType;
  notes?: string | null;
};

export type DepartmentAssignmentDoctorRecord = Pick<
  User,
  'id' | 'username' | 'role' | 'isActive'
>;

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
