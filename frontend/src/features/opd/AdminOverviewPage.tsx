import { useMemo, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  TriangleAlert,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { type ApiError } from '@/lib/api/client';

import {
  useAdminDepartmentsQuery,
  useAssignDepartmentDoctorMutation,
  useCreateDepartmentMutation,
} from '@/features/admin/hooks';
import { type AdminDepartment } from '@/features/admin/api';
import { AdminConfigStateCard } from '@/features/admin/components/admin-config-state-card';

type ValidationField = 'departmentName' | 'departmentId' | 'doctorUserId';

type FeedbackState =
  | {
      code: string;
      description: string;
      diagnostics: string[];
      metadata?: Record<string, string | undefined>;
      status: 'success' | 'validation' | 'unavailable';
      testId: string;
      title: string;
    }
  | null;

type FormState = {
  departmentId: string;
  departmentName: string;
  doctorUserId: string;
};

const INITIAL_FORM_STATE: FormState = {
  departmentId: '',
  departmentName: '',
  doctorUserId: '',
};

export function AdminOverviewPage() {
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);
  const [feedbackState, setFeedbackState] = useState<FeedbackState>(null);

  const departmentsQuery = useAdminDepartmentsQuery();
  const createDepartmentMutation = useCreateDepartmentMutation();
  const assignDoctorMutation = useAssignDepartmentDoctorMutation();

  const departments = departmentsQuery.data ?? [];
  const assignmentCount = departments.filter((department) => department.assignedDoctor).length;

  const boundaryState = useMemo(() => {
    if (departmentsQuery.isPending) {
      return {
        code: 'LOADING',
        description:
          'Loading the live department workspace before any admin configuration controls render.',
        diagnostics: [
          'The page waits for the authoritative department list before rendering assignment controls.',
          'No optimistic staffing state is shown while the live contract is unresolved.',
        ],
        status: 'loading' as const,
        testId: 'admin-overview-loading-state',
        title: 'Loading admin configuration',
      };
    }

    if (departmentsQuery.error) {
      return {
        code: mapApiErrorCode(departmentsQuery.error),
        description:
          'The admin configuration API could not be verified, so the workspace stays fail closed.',
        diagnostics: buildAdminErrorDiagnostics(departmentsQuery.error),
        status: 'unavailable' as const,
        testId: 'admin-overview-unavailable-state',
        title: 'Admin configuration unavailable',
      };
    }

    if (departments.length === 0) {
      return {
        code: 'EMPTY',
        description:
          'Create the first live department before any doctor assignment can be applied to receptionist scheduling.',
        diagnostics: [
          'The backend returned zero departments.',
          'Scheduling will remain fail closed until an admin creates a department and assigns a doctor.',
        ],
        status: 'empty' as const,
        testId: 'admin-overview-empty-state',
        title: 'No departments configured yet',
      };
    }

    return {
      code: 'READY',
      description:
        'The live admin workspace can create departments and bind one current doctor assignment per department.',
      diagnostics: [
        `Loaded ${departments.length} department${departments.length === 1 ? '' : 's'} from the live Node contract.`,
        `${assignmentCount} current doctor assignment${assignmentCount === 1 ? '' : 's'} are shaping receptionist scheduling visibility.`,
      ],
      status: 'ready' as const,
      testId: 'admin-overview-ready-state',
      title: 'Admin configuration ready',
    };
  }, [assignmentCount, departments, departmentsQuery.error, departmentsQuery.isPending]);

  const isMutating = createDepartmentMutation.isPending || assignDoctorMutation.isPending;

  return (
    <section className="space-y-5 sm:space-y-6" data-testid="admin-overview-page">
      <div className="dashboard-card p-6 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <Badge className="brand-soft rounded-full px-3 py-1 text-[11px] sm:text-xs" variant="secondary">
            Admin workspace
          </Badge>
          <Badge className="rounded-full border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 sm:text-xs" variant="outline">
            {departmentsQuery.isPending ? 'Syncing live config' : `${departments.length} departments`}
          </Badge>
          <Badge className="rounded-full border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 sm:text-xs" variant="outline">
            {assignmentCount} live assignments
          </Badge>
        </div>
        <div className="mt-5 max-w-4xl space-y-3 sm:mt-6">
          <h2 className="text-balance text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-3xl">
            Admin configuration workspace
          </h2>
          <p className="text-pretty text-[15px] leading-7 text-slate-600 sm:text-base">
            Create live departments, assign the current doctor for each operational lane, and keep
            receptionist scheduling pinned to that authoritative configuration instead of generic
            active-doctor data.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px] xl:items-start">
        <div className="space-y-6">
          <Card className="dashboard-card overflow-hidden border-border rounded-[28px] sm:rounded-[30px]">
            <CardHeader className="gap-4 border-b border-slate-200/70 pb-5 sm:pb-6">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 shadow-sm">
                  <Stethoscope className="size-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <CardTitle className="text-xl">Department setup and assignment</CardTitle>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    Department creation is friendly, while doctor assignment uses the authoritative
                    doctor principal ID returned by the runtime until a broader staff-directory seam
                    exists.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:p-5 lg:p-6">
              {boundaryState.status === 'loading' ? (
                <LoadingCard />
              ) : boundaryState.status === 'unavailable' ? (
                <AdminConfigStateCard
                  code={boundaryState.code}
                  description={boundaryState.description}
                  diagnostics={boundaryState.diagnostics}
                  icon={<TriangleAlert className="size-5" />}
                  status="unavailable"
                  testId={boundaryState.testId}
                  title={boundaryState.title}
                  tone="border-slate-200 bg-slate-50/80 text-slate-950"
                />
              ) : (
                <>
                  <div className="grid gap-5 lg:grid-cols-2">
                    <Card className="rounded-[24px] border border-slate-200/80 bg-white/75 shadow-none">
                      <CardHeader className="space-y-2 pb-3">
                        <CardTitle className="text-lg">Create department</CardTitle>
                        <p className="text-sm leading-6 text-muted-foreground">
                          Add a live department first so downstream scheduling can prove its source configuration.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <form
                          className="space-y-4"
                          data-testid="admin-department-create-form"
                          onSubmit={(event) => void handleCreateDepartment(event)}
                        >
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-900" htmlFor="admin-department-name">
                              Department name
                            </label>
                            <Input
                              className="h-11 rounded-xl border-slate-200 bg-white"
                              data-testid="admin-department-name-input"
                              id="admin-department-name"
                              onChange={(event) => handleFieldChange('departmentName', event.target.value)}
                              placeholder="Cardiology"
                              value={formState.departmentName}
                            />
                          </div>
                          <Button
                            aria-busy={createDepartmentMutation.isPending}
                            className="brand-button h-11 rounded-xl px-5"
                            data-testid="admin-create-department-submit-button"
                            disabled={isMutating}
                            type="submit"
                          >
                            {createDepartmentMutation.isPending ? (
                              <>
                                Creating...
                                <LoaderCircle className="size-4 animate-spin" />
                              </>
                            ) : (
                              'Create department'
                            )}
                          </Button>
                        </form>
                      </CardContent>
                    </Card>

                    <Card className="rounded-[24px] border border-slate-200/80 bg-slate-50/75 shadow-none">
                      <CardHeader className="space-y-2 pb-3">
                        <CardTitle className="text-lg">Assign current doctor</CardTitle>
                        <p className="text-sm leading-6 text-muted-foreground">
                          Bind one active doctor principal to the selected department. Reception scheduling will only see assigned doctors.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <form
                          className="space-y-4"
                          data-testid="admin-department-assignment-form"
                          onSubmit={(event) => void handleAssignDoctor(event)}
                        >
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-900" htmlFor="admin-department-select">
                              Department
                            </label>
                            <select
                              className="focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                              data-testid="admin-department-select"
                              disabled={departments.length === 0 || isMutating}
                              id="admin-department-select"
                              onChange={(event) => handleFieldChange('departmentId', event.target.value)}
                              value={formState.departmentId}
                            >
                              <option value="">Select a department</option>
                              {departments.map((department) => (
                                <option key={department.id} value={department.id}>
                                  {department.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-900" htmlFor="admin-doctor-user-id-input">
                              Doctor principal ID
                            </label>
                            <Input
                              className="h-11 rounded-xl border-slate-200 bg-white"
                              data-testid="admin-doctor-user-id-input"
                              disabled={departments.length === 0 || isMutating}
                              id="admin-doctor-user-id-input"
                              onChange={(event) => handleFieldChange('doctorUserId', event.target.value)}
                              placeholder="user_1"
                              value={formState.doctorUserId}
                            />
                          </div>

                          <p className="text-sm leading-6 text-slate-500" data-testid="admin-doctor-id-guidance">
                            Use the authoritative doctor principal ID. The backend resolves whether that principal is an active doctor and returns the truthful assigned username.
                          </p>

                          <Button
                            aria-busy={assignDoctorMutation.isPending}
                            className="h-11 rounded-xl px-5"
                            data-testid="admin-assign-doctor-submit-button"
                            disabled={departments.length === 0 || isMutating}
                            type="submit"
                            variant="outline"
                          >
                            {assignDoctorMutation.isPending ? (
                              <>
                                Assigning...
                                <LoaderCircle className="size-4 animate-spin" />
                              </>
                            ) : (
                              'Assign doctor'
                            )}
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                  </div>

                  {feedbackState ? renderFeedbackState(feedbackState) : null}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">Live department state</h3>
                        <p className="text-sm leading-6 text-slate-500">
                          Each card reflects the current department assignment shaping receptionist scheduling.
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {departments.map((department) => (
                        <DepartmentCard key={department.id} department={department} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {boundaryState.status === 'ready' || boundaryState.status === 'empty' ? (
            <AdminConfigStateCard
              code={boundaryState.code}
              description={boundaryState.description}
              diagnostics={boundaryState.diagnostics}
              icon={boundaryState.status === 'ready' ? <CheckCircle2 className="size-5" /> : <TriangleAlert className="size-5" />}
              status={boundaryState.status}
              testId={boundaryState.testId}
              title={boundaryState.title}
              tone={boundaryState.status === 'ready' ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950' : 'border-slate-200 bg-slate-50/80 text-slate-950'}
            />
          ) : null}

          <Card className="dashboard-card border-border rounded-[28px] sm:rounded-[30px]">
            <CardHeader className="gap-2 pb-4">
              <CardTitle className="text-lg">Workflow guarantees</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                This admin surface remains truthful to the live contract and preserves downstream fail-closed behavior.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <ul className="space-y-3">
                <li>• `/app/admin` renders a real workspace for admins instead of `CONTRACT_PENDING`.</li>
                <li>• Receptionists are still denied by the protected-route boundary on direct `/app/admin` navigation.</li>
                <li>• Doctor assignment invalidates the receptionist directory query so stale options do not linger.</li>
                <li>• API failures and malformed payloads keep the workspace explicitly unavailable instead of optimistic.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );

  function handleFieldChange(field: keyof FormState, value: string) {
    clearFeedback();
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function clearFeedback() {
    if (feedbackState) {
      setFeedbackState(null);
    }
  }

  async function handleCreateDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    const departmentName = formState.departmentName.trim();
    if (!departmentName) {
      setFeedbackState(
        validationState('departmentName', 'Department name is required before creation can begin.'),
      );
      return;
    }

    try {
      const department = await createDepartmentMutation.mutateAsync({ name: departmentName });
      setFormState((current) => ({
        ...current,
        departmentId: department.id,
        departmentName: '',
      }));
      setFeedbackState({
        code: 'DEPARTMENT_CREATED',
        description: 'The live backend created the department and the workspace refreshed the authoritative list.',
        diagnostics: [
          `Created department ${department.name}.`,
          'Doctor assignment remains empty until an explicit assignment succeeds.',
        ],
        metadata: {
          'data-assignment-count': String(department.assignmentCount),
          'data-department-id': department.id,
          'data-department-name': department.name,
        },
        status: 'success',
        testId: 'admin-overview-success-state',
        title: 'Department created',
      });
    } catch (error) {
      setFeedbackState(mapActionErrorToFeedback(error));
    }
  }

  async function handleAssignDoctor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    const departmentId = formState.departmentId.trim();
    if (!departmentId) {
      setFeedbackState(
        validationState('departmentId', 'Select a department before assigning a doctor.'),
      );
      return;
    }

    const doctorUserId = formState.doctorUserId.trim();
    if (!doctorUserId) {
      setFeedbackState(
        validationState('doctorUserId', 'Enter a doctor principal ID before assigning the live department.'),
      );
      return;
    }

    try {
      const department = await assignDoctorMutation.mutateAsync({
        departmentId,
        doctorUserId,
      });
      setFormState((current) => ({
        ...current,
        doctorUserId: '',
      }));
      setFeedbackState({
        code: 'DOCTOR_ASSIGNED',
        description: 'The department now exposes a live doctor assignment that receptionist scheduling can consume.',
        diagnostics: [
          `Assigned doctor ${department.assignedDoctor?.username ?? 'unknown'} to ${department.name}.`,
          'The receptionist doctor directory query was invalidated so stale options do not persist.',
        ],
        metadata: {
          'data-assigned-doctor-id': department.assignedDoctor?.id,
          'data-assigned-doctor-username': department.assignedDoctor?.username,
          'data-assignment-count': String(department.assignmentCount),
          'data-department-id': department.id,
          'data-department-name': department.name,
        },
        status: 'success',
        testId: 'admin-overview-success-state',
        title: 'Doctor assigned',
      });
    } catch (error) {
      setFeedbackState(mapActionErrorToFeedback(error));
    }
  }
}

function DepartmentCard({ department }: { department: AdminDepartment }) {
  const assignedDoctorName = department.assignedDoctor?.username ?? 'Unassigned';

  return (
    <Card
      className="rounded-[24px] border border-slate-200/80 bg-white/80 shadow-none"
      data-assigned-doctor-id={department.assignedDoctor?.id}
      data-assigned-doctor-username={department.assignedDoctor?.username}
      data-assignment-count={String(department.assignmentCount)}
      data-department-id={department.id}
      data-testid={`admin-department-card-${department.id}`}
    >
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">{department.name}</CardTitle>
          <Badge className="rounded-full border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700" variant="outline">
            {department.assignmentCount === 1 ? 'Assigned' : 'Awaiting assignment'}
          </Badge>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Department ID: <span className="font-medium text-slate-900">{department.id}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-3xl border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="font-semibold text-slate-900">Current assigned doctor</p>
          <p className="mt-2 text-slate-600" data-testid={`admin-department-assigned-doctor-${department.id}`}>
            {assignedDoctorName}
          </p>
        </div>
        <dl className="grid gap-3 [font-variant-numeric:tabular-nums]">
          <SummaryRow label="Assignment count" value={String(department.assignmentCount)} />
          <SummaryRow label="Updated" value={new Date(department.updatedAt).toLocaleString()} />
        </dl>
      </CardContent>
    </Card>
  );
}

function LoadingCard() {
  return (
    <Card className="rounded-[24px] border border-slate-200/80 bg-white/80 shadow-none" data-testid="admin-overview-loading-state">
      <CardHeader className="space-y-4 pb-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 shadow-sm">
          <RefreshCw className="size-5 animate-spin" />
        </div>
        <div className="space-y-2">
          <CardTitle className="text-xl">Loading live admin configuration</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            Waiting for the backend department list before rendering any create or assignment controls.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-1/2 rounded-full" />
        <Skeleton className="h-4 w-full rounded-full" />
        <Skeleton className="h-4 w-5/6 rounded-full" />
      </CardContent>
    </Card>
  );
}

function SummaryRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 pb-3 last:border-b-0 last:pb-0">
      <dt className="font-medium text-slate-700">{props.label}</dt>
      <dd className="text-right text-slate-950">{props.value}</dd>
    </div>
  );
}

function renderFeedbackState(feedbackState: NonNullable<FeedbackState>) {
  if (feedbackState.status === 'validation') {
    return (
      <Alert
        className="rounded-2xl border-amber-300/40 bg-amber-50 text-amber-950"
        data-screen-code={feedbackState.code}
        data-screen-status="validation"
        data-testid={feedbackState.testId}
      >
        <CircleAlert className="size-4" />
        <AlertTitle>{feedbackState.title}</AlertTitle>
        <AlertDescription>{feedbackState.description}</AlertDescription>
      </Alert>
    );
  }

  return (
    <AdminConfigStateCard
      code={feedbackState.code}
      description={feedbackState.description}
      diagnostics={feedbackState.diagnostics}
      icon={feedbackState.status === 'success' ? <CheckCircle2 className="size-5" /> : <ShieldAlert className="size-5" />}
      metadata={feedbackState.metadata}
      status={feedbackState.status}
      testId={feedbackState.testId}
      title={feedbackState.title}
      tone={feedbackState.status === 'success' ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950' : 'border-slate-200 bg-slate-50/80 text-slate-950'}
    />
  );
}

function validationState(field: ValidationField, message: string): NonNullable<FeedbackState> {
  return {
    code: 'INVALID_FORM',
    description: message,
    diagnostics: [`Validation blocked the ${field} field before any live mutation ran.`],
    status: 'validation',
    testId: 'admin-overview-validation-state',
    title: 'Fix the admin form',
  };
}

function mapActionErrorToFeedback(error: unknown): NonNullable<FeedbackState> {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const apiError = error as ApiError;

    if (apiError.code === 'CONFLICT' || apiError.code === 'DEPARTMENT_NAME_CONFLICT') {
      return {
        code: apiError.code,
        description: apiError.message,
        diagnostics: [
          'The backend rejected the mutation as a user-correctable conflict.',
          'No optimistic department or assignment state was rendered.',
        ],
        status: 'validation',
        testId: 'admin-overview-validation-state',
        title: 'Resolve the admin conflict',
      };
    }

    return {
      code: apiError.code,
      description: apiError.message,
      diagnostics: buildAdminErrorDiagnostics(apiError),
      status: 'unavailable',
      testId: 'admin-overview-unavailable-state',
      title: 'Admin configuration unavailable',
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    description: 'The admin action failed before a trustworthy result could be rendered.',
    diagnostics: [
      'An unexpected client-side failure reached the admin action boundary.',
      'The workspace stayed fail closed instead of inferring success.',
    ],
    status: 'unavailable',
    testId: 'admin-overview-unavailable-state',
    title: 'Admin configuration unavailable',
  };
}

function mapApiErrorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as ApiError).code)
    : 'UNAVAILABLE';
}

function buildAdminErrorDiagnostics(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    return [
      `Last API error code: ${String((error as ApiError).code)}`,
      'Retry after the admin configuration contract or upstream dependency recovers.',
    ];
  }

  return [
    'The admin client rejected the response as untrustworthy.',
    'No optimistic department or assignment state was rendered.',
  ];
}
