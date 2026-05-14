import { OperationalStateView } from '@/features/opd/components/OperationalStateView';
import { useOperationalFoundation } from '@/features/opd/lib/foundations';

export function SchedulingPage() {
  const foundationQuery = useOperationalFoundation('reception-scheduling');

  return (
    <OperationalStateView
      description="Reception scheduling stays fail-closed until the adapter can verify patient lookup, slot availability, and booking conflicts against the live Node contract."
      foundation={foundationQuery.data}
      isLoading={foundationQuery.isPending}
      roleLabel="Receptionist"
      screenId="reception-scheduling"
      title="Scheduling workspace"
    />
  );
}
