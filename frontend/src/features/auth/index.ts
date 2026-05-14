export { LoginPage } from './components/LoginPage';
export { ProtectedRoute } from './components/ProtectedRoute';
export { AuthProvider } from './stores/auth-provider';
export {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
  type UserRole,
  type UserSession,
  normalizeRole,
  useAuth,
} from '@/lib/auth/session';

export function resolveHomePath(role: 'admin' | 'doctor' | 'receptionist') {
  if (role === 'doctor') {
    return '/app/doctor/queue';
  }

  if (role === 'receptionist') {
    return '/app/reception/scheduling';
  }

  return '/app/admin';
}
