import { OperationalStateView } from './components/OperationalStateView';
import { useOperationalFoundation } from './lib/foundations';

export function AdminOverviewPage() {
  const foundationQuery = useOperationalFoundation('admin-overview');

  return (
    <OperationalStateView
      description="Administrative insight, staffing governance, and cross-role system signals stay bound to explicit state surfaces until the live Node contract is available."
      foundation={foundationQuery.data}
      isLoading={foundationQuery.isPending}
      roleLabel="Admin"
      screenId="admin-overview"
      title="Admin overview workspace"
    />
  );
}
