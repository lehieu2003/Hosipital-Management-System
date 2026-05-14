import { OperationalStateView } from '@/features/opd/components/OperationalStateView';
import { useOperationalFoundation } from '@/features/opd/lib/foundations';

export function QueuePage() {
  const foundationQuery = useOperationalFoundation('doctor-queue');

  return (
    <OperationalStateView
      description="Doctor queue access stays fail-closed until the adapter can confirm live queue, progression, and consult transitions against the Node contract."
      foundation={foundationQuery.data}
      isLoading={foundationQuery.isPending}
      roleLabel="Doctor"
      screenId="doctor-queue"
      title="Queue workspace"
    />
  );
}
