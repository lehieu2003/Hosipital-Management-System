import { db } from '../../../infrastructure/database/client.js';
import {
  departmentWithAssignmentSelect,
  requireDepartmentRecord,
  validateDepartmentRecord,
} from './opd.department-records.js';
import { wrapOpdStoreError } from './opd.errors.js';
import type {
  AssignDepartmentDoctorRecordInput,
  CreateDepartmentRecordInput,
} from './opd.types.js';

export class OpdDepartmentQueries {
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
        requireDepartmentRecord(
          department,
          'list_departments_with_assignments',
        ),
      );
    } catch (error) {
      return wrapOpdStoreError('list_departments_with_assignments', error);
    }
  }

  async assignDoctorToDepartment({
    departmentId,
    doctorUserId,
  }: AssignDepartmentDoctorRecordInput) {
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

        return requireDepartmentRecord(
          department,
          'assign_doctor_to_department',
        );
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

        if (
          !validatedDepartment?.assignedDoctor ||
          validatedDepartment.assignedDoctor.isActive !== true
        ) {
          throw new Error(
            'Doctor directory lookup returned malformed assigned doctor state',
          );
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
}
