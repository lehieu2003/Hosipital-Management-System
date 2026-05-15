export const ERROR_CODES = {
  internalError: 'INTERNAL_ERROR',
  validationError: 'VALIDATION_ERROR',
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  authUnavailable: 'AUTH_UNAVAILABLE',
  opdUnavailable: 'OPD_UNAVAILABLE',
  patientNotFound: 'PATIENT_NOT_FOUND',
  doctorNotFound: 'DOCTOR_NOT_FOUND',
  appointmentNotFound: 'APPOINTMENT_NOT_FOUND',
  appointmentVersionConflict: 'APPOINTMENT_VERSION_CONFLICT',
  schedulingTargetNotDoctor: 'SCHEDULING_TARGET_NOT_DOCTOR',
} as const;
