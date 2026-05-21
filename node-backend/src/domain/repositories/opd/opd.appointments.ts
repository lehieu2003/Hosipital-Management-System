import { AppointmentStatus } from '@prisma/client/index';

import { db } from '../../../infrastructure/database/client.js';
import { wrapOpdStoreError } from './opd.errors.js';
import type {
  CreateAppointmentRecordInput,
  UpdateAppointmentRecordInput,
} from './opd.types.js';

const ACTIVE_DOCTOR_QUEUE_STATUSES = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CHECKED_IN,
] as const;

export class OpdAppointmentQueries {
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
        throw new Error(
          'Appointment lookup returned malformed patient relation',
        );
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
          throw new Error(
            'Doctor queue lookup returned malformed patient relation',
          );
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
            ...(ownedByDoctorUserId !== undefined
              ? { doctorUserId: ownedByDoctorUserId }
              : {}),
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
          throw new Error(
            'Appointment update returned no row after successful write',
          );
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
