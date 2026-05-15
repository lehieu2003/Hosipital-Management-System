export const ERROR_CODES = {
  internalError: 'INTERNAL_ERROR',
  validationError: 'VALIDATION_ERROR',
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  authUnavailable: 'AUTH_UNAVAILABLE',
  opdUnavailable: 'OPD_UNAVAILABLE',
  patientNotFound: 'PATIENT_NOT_FOUND',
  doctorNotFound: 'DOCTOR_NOT_FOUND',
  schedulingTargetNotDoctor: 'SCHEDULING_TARGET_NOT_DOCTOR',
} as const;
