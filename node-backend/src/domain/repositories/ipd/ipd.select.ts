export const bedSelect = {
  id: true,
  bedNumber: true,
  wardName: true,
  roomNumber: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const operatorSelect = {
  id: true,
  username: true,
  role: true,
  isActive: true,
} as const;

export const bedOccupancySelect = {
  id: true,
  admissionId: true,
  bedId: true,
  assignedByUserId: true,
  assignedAt: true,
  lastTransferredAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  bed: {
    select: bedSelect,
  },
  assignedByUser: {
    select: operatorSelect,
  },
} as const;

export const admissionSelect = {
  id: true,
  patientId: true,
  status: true,
  attendingDoctorUserId: true,
  admittedByUserId: true,
  admittedAt: true,
  dischargeAt: true,
  dischargeNotes: true,
  dischargedByUserId: true,
  notes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  currentBedOccupancy: {
    select: bedOccupancySelect,
  },
} as const;

export const admissionWithPatientSelect = {
  ...admissionSelect,
  patient: {
    select: {
      id: true,
      registrationNumber: true,
      fullName: true,
      primaryPhone: true,
    },
  },
} as const;

export const bedMovementSelect = {
  id: true,
  admissionId: true,
  movementType: true,
  fromBedId: true,
  toBedId: true,
  movedByUserId: true,
  movedAt: true,
  note: true,
  createdAt: true,
  fromBed: {
    select: bedSelect,
  },
  toBed: {
    select: bedSelect,
  },
  movedByUser: {
    select: operatorSelect,
  },
} as const;

export const currentBedOccupancySelect = {
  ...bedOccupancySelect,
  admission: {
    select: {
      id: true,
      patientId: true,
      status: true,
      admittedAt: true,
      dischargeAt: true,
      version: true,
      patient: {
        select: {
          id: true,
          registrationNumber: true,
          fullName: true,
          primaryPhone: true,
        },
      },
    },
  },
} as const;
