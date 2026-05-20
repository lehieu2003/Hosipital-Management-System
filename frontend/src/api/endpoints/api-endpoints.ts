export const API_ENDPOINTS = {
  admin: {
    departmentDoctorAssignment: (departmentId: string) =>
      `/admin/config/departments/${encodeURIComponent(departmentId)}/doctor-assignment`,
    departments: '/admin/config/departments',
  },
  appointments: {
    collection: '/appointments',
    doctors: '/doctors',
    patients: '/patients',
  },
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    me: '/auth/me',
    refresh: '/auth/refresh',
  },
  ipd: {
    admissionBedAssignment: (admissionId: string) =>
      `/ipd/admissions/${encodeURIComponent(admissionId)}/bed-assignment`,
    admissionBedTransfer: (admissionId: string) =>
      `/ipd/admissions/${encodeURIComponent(admissionId)}/bed-transfer`,
    admissionDischarge: (admissionId: string) =>
      `/ipd/admissions/${encodeURIComponent(admissionId)}/discharge`,
    admissionMovements: (admissionId: string) =>
      `/ipd/admissions/${encodeURIComponent(admissionId)}/movements`,
    admissions: '/ipd/admissions',
    occupancy: '/ipd/occupancy',
  },
  queue: {
    doctorQueue: '/doctor/queue',
    doctorQueueAppointment: (appointmentId: string) =>
      `/doctor/queue/${encodeURIComponent(appointmentId)}`,
  },
} as const;
