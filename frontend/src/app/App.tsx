import { ShieldCheck, Workflow, Wrench } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MainLayout } from '@/components/layout/MainLayout';
import { SchedulingPage } from '@/features/appointments/SchedulingPage';
import { LoginPage, ProtectedRoute, resolveHomePath, useAuth } from '@/features/auth';
import { QueuePage } from '@/features/queue/QueuePage';

function HomeRedirect() {
  const { session } = useAuth();

  if (!session) {
    return <Navigate replace to="/login" />;
  }

  return <Navigate replace to={resolveHomePath(session.role)} />;
}

const adminCards = [
  {
    copy: 'Navigation, auth gating, and sign-out state are live now. Operational forms stay disabled until the backend contract exists.',
    icon: ShieldCheck,
    label: 'Current boundary',
    title: 'Role-aware shell only',
  },
  {
    copy: 'Protected admin screens should refuse to imply access or success when session state or downstream configuration is incomplete.',
    icon: Workflow,
    label: 'Safety rule',
    title: 'Fail closed on uncertainty',
  },
  {
    copy: 'Once the backend exposes staffing endpoints, this space can absorb configuration forms without another visual rewrite.',
    icon: Wrench,
    label: 'Next integration',
    title: 'User and roster setup',
  },
];

function AdminPage() {
  return (
    <section className="space-y-6">
      <Card className="border-primary/10 bg-background/90 shadow-sm">
        <CardHeader className="gap-3">
          <Badge variant="secondary">Admin</Badge>
          <div className="space-y-2">
            <CardTitle className="text-balance text-3xl">Administration shell</CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7">
              Department setup, user administration, and doctor assignment controls are the next
              admin-facing layer. This shell keeps the protected route contract and visual system
              stable while those workflows land.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {adminCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.title} className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader className="gap-4">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="space-y-2">
                  <Badge className="w-fit" variant="outline">
                    {card.label}
                  </Badge>
                  <CardTitle className="text-xl">{card.title}</CardTitle>
                  <CardDescription className="text-sm leading-6">{card.copy}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                  Reserved for future admin controls that are backed by a real API contract.
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<HomeRedirect />} path="/" />
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route element={<AdminPage />} path="/admin" />
        <Route element={<SchedulingPage />} path="/reception/scheduling" />
        <Route element={<QueuePage />} path="/doctor/queue" />
      </Route>
    </Routes>
  );
}
