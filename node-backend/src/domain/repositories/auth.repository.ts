import { AuthRefreshSessionQueries } from './auth/auth.refresh-sessions.js';
import { AuthUserQueries } from './auth/auth.users.js';

class AuthRepository {
  private readonly users = new AuthUserQueries();
  private readonly refreshSessions = new AuthRefreshSessionQueries();

  findUserByUsername =
    this.users.findUserByUsername.bind(this.users);
  findUserById = this.users.findUserById.bind(this.users);
  createUser = this.users.createUser.bind(this.users);

  createRefreshSession =
    this.refreshSessions.createRefreshSession.bind(this.refreshSessions);
  findRefreshSessionByJti =
    this.refreshSessions.findRefreshSessionByJti.bind(this.refreshSessions);
  revokeRefreshSession =
    this.refreshSessions.revokeRefreshSession.bind(this.refreshSessions);
  revokeAllUserSessions =
    this.refreshSessions.revokeAllUserSessions.bind(this.refreshSessions);
}

export const authRepository = new AuthRepository();

export type {
  AuthRefreshSessionRecord,
  AuthUserRecord,
  CreateRefreshSessionInput,
  CreateUserRecordInput,
} from './auth/auth.types.js';
