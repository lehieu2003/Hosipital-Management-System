import { OpdAppointmentQueries } from './opd/opd.appointments.js';
import { OpdDepartmentQueries } from './opd/opd.departments.js';
import { OpdPatientQueries } from './opd/opd.patients.js';

class OpdRepository {
  private readonly patients = new OpdPatientQueries();
  private readonly departments = new OpdDepartmentQueries();
  private readonly appointments = new OpdAppointmentQueries();

  createPatient = this.patients.createPatient.bind(this.patients);
  findPatientById = this.patients.findPatientById.bind(this.patients);
  findUserById = this.patients.findUserById.bind(this.patients);

  createDepartment =
    this.departments.createDepartment.bind(this.departments);
  findDepartmentById =
    this.departments.findDepartmentById.bind(this.departments);
  findDepartmentByName =
    this.departments.findDepartmentByName.bind(this.departments);
  listDepartmentsWithAssignments =
    this.departments.listDepartmentsWithAssignments.bind(this.departments);
  assignDoctorToDepartment =
    this.departments.assignDoctorToDepartment.bind(this.departments);
  findAssignedDoctorDirectory =
    this.departments.findAssignedDoctorDirectory.bind(this.departments);

  createAppointment =
    this.appointments.createAppointment.bind(this.appointments);
  findAppointmentById =
    this.appointments.findAppointmentById.bind(this.appointments);
  findAppointmentWithPatientById =
    this.appointments.findAppointmentWithPatientById.bind(this.appointments);
  findActiveQueueByDoctorUserId =
    this.appointments.findActiveQueueByDoctorUserId.bind(this.appointments);
  updateAppointmentWithVersion =
    this.appointments.updateAppointmentWithVersion.bind(this.appointments);
}

export const opdRepository = new OpdRepository();

export type {
  AssignedDoctorDirectoryRecord,
  AssignDepartmentDoctorRecordInput,
  CreateAppointmentRecordInput,
  CreateDepartmentRecordInput,
  CreatePatientRecordInput,
  DepartmentAssignmentDoctorRecord,
  DepartmentRecord,
  OpdAppointmentRecord,
  OpdAssignedDoctorDirectoryRecord,
  OpdDepartmentRecord,
  OpdDoctorDirectoryRecord,
  OpdDoctorQueueRecord,
  OpdPatientRecord,
  OpdUserRecord,
  UpdateAppointmentRecordInput,
} from './opd/opd.types.js';
