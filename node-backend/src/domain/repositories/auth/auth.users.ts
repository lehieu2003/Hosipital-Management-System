import { db } from '../../../infrastructure/database/client.js';
import { wrapAuthStoreError } from './auth.errors.js';
import type { CreateUserRecordInput } from './auth.types.js';

export class AuthUserQueries {
  async findUserByUsername(username: string) {
    try {
      return await db.user.findUnique({
        where: { username },
      });
    } catch (error) {
      return wrapAuthStoreError('find_user_by_username', error);
    }
  }

  async findUserById(id: string) {
    try {
      return await db.user.findUnique({
        where: { id },
      });
    } catch (error) {
      return wrapAuthStoreError('find_user_by_id', error);
    }
  }

  async createUser(data: CreateUserRecordInput) {
    try {
      return await db.user.create({
        data,
      });
    } catch (error) {
      return wrapAuthStoreError('create_user', error);
    }
  }
}
