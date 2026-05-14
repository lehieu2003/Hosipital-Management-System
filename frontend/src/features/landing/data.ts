import type { LucideIcon } from 'lucide-react';
import {
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  LockKeyhole,
  ShieldCheck,
  Stethoscope,
  UserRoundPlus,
  Workflow,
} from 'lucide-react';

export type LandingRoleCard = {
  bullets: string[];
  description: string;
  icon: LucideIcon;
  label: string;
  tone: string;
};

export type LandingWorkflowStep = {
  description: string;
  icon: LucideIcon;
  step: string;
  title: string;
};

export type LandingTrustCard = {
  description: string;
  icon: LucideIcon;
  title: string;
};

export type LandingSurfacePreview = {
  accent: string;
  label: string;
  meta: string;
};

export type LandingMetric = {
  label: string;
  value: string;
};

export const landingRoleCards: LandingRoleCard[] = [
  {
    bullets: [
      'Department setup and doctor assignment',
      'Permission boundaries stay server-authoritative',
      'Operational overview without role leakage',
    ],
    description: 'Shape care structure and access before frontline work begins.',
    icon: ShieldCheck,
    label: 'Admin',
    tone: 'bg-cyan-50 text-cyan-700',
  },
  {
    bullets: [
      'Patient intake and identity capture',
      'Conflict-aware appointment scheduling',
      'Unavailable and retry states stay explicit',
    ],
    description: 'Keep front-desk work calm, readable, and safe under pressure.',
    icon: UserRoundPlus,
    label: 'Receptionist',
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    bullets: [
      'Live queue visibility',
      'Next-action consultation flow',
      'Refresh-aware session continuity',
    ],
    description: 'See the next patient and move care state with confidence.',
    icon: Stethoscope,
    label: 'Doctor',
    tone: 'bg-violet-50 text-violet-700',
  },
];

export const landingWorkflowSteps: LandingWorkflowStep[] = [
  {
    description:
      'Create departments, assign doctors, and make role boundaries visible before operations begin.',
    icon: ShieldCheck,
    step: '01',
    title: 'Configure care structure',
  },
  {
    description:
      'Register patients and book appointments with clear scheduling context and explicit conflict handling.',
    icon: CalendarCheck2,
    step: '02',
    title: 'Book the visit',
  },
  {
    description:
      'Process the queue with current operational state and fail-closed session behavior when continuity breaks.',
    icon: Workflow,
    step: '03',
    title: 'Progress consultation flow',
  },
];

export const landingTrustCards: LandingTrustCard[] = [
  {
    description: 'Access is shaped by role boundaries, not by assumptions in the interface.',
    icon: LockKeyhole,
    title: 'Role-aware access',
  },
  {
    description:
      'Conflicting updates are surfaced directly instead of being hidden behind stale success states.',
    icon: ClipboardList,
    title: 'Conflict-safe flow',
  },
  {
    description:
      'Auth, forbidden, and unavailable states are visible so staff know what happened and what to do next.',
    icon: HeartPulse,
    title: 'Explicit failure states',
  },
  {
    description:
      'Recovery retries once where safe, then returns users to sign-in rather than implying access still holds.',
    icon: CheckCircle2,
    title: 'Fail-closed continuity',
  },
];

export const landingSurfacePreview: LandingSurfacePreview[] = [
  {
    accent: 'bg-cyan-600',
    label: 'Reception scheduling',
    meta: 'Patient search · doctor slot · conflict guard',
  },
  {
    accent: 'bg-emerald-500',
    label: 'Doctor queue',
    meta: 'Next patient · queue freshness · status progress',
  },
  {
    accent: 'bg-violet-500',
    label: 'Admin control',
    meta: 'Department setup · assignments · policy clarity',
  },
];

export const landingOverviewItems = [
  {
    label: 'Admin setup',
    value: 'Departments, assignments, and policy surfaces stay controlled and readable.',
  },
  {
    label: 'Scheduling',
    value: 'Reception work focuses on intake, slot choice, and conflict-safe booking.',
  },
  {
    label: 'Queue flow',
    value: 'Doctors see next actions and current session state without stale fallbacks.',
  },
];

export const landingPostureItems = [
  'Session expiry retries once where safe, then returns to sign-in clearly.',
  'Operational screens never imply safe access when auth continuity is broken.',
  'Unavailable and conflict states are surfaced directly for staff action.',
];

export const landingHeroHighlights = [
  'Role-aware access across Admin, Receptionist, and Doctor views',
  'Conflict-safe scheduling and queue progression',
  'Explicit unavailable and refresh-failed states',
];

export const landingHeroMetrics: LandingMetric[] = [
  { label: 'Roles', value: '3 operational views' },
  { label: 'Flow', value: 'Setup → schedule → queue' },
  { label: 'Posture', value: 'Fail-closed by design' },
];
