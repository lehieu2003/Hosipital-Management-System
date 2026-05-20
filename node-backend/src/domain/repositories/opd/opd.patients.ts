import { db } from '../../../infrastructure/database/client.js';
import { wrapOpdStoreError } from './opd.errors.js';
import type { CreatePatientRecordInput } from './opd.types.js';

export class OpdPatientQueries {
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
}
