import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  ChartNoAxesColumnIncreasing,
  CircleDollarSign,
  ClipboardPlus,
  FileUp,
  HeartPulse,
  UsersRound,
} from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MainLayout } from '@/components/layout/MainLayout';
import { SchedulingPage } from '@/features/appointments/SchedulingPage';
import { LoginPage, ProtectedRoute, resolveHomePath, useAuth } from '@/features/auth';
import { LandingPage } from '@/features/landing/LandingPage';
import { QueuePage } from '@/features/queue/QueuePage';

function AppRedirect() {
  const { session } = useAuth();

  if (!session) {
    return <Navigate replace to="/login" />;
  }

  return <Navigate replace to={resolveHomePath(session.role)} />;
}

const metrics = [
  {
    change: '+6.1%',
    icon: CircleDollarSign,
    label: 'Monthly recurring revenue',
    tone: 'text-emerald-600',
    value: '$34.1K',
  },
  {
    change: '+19.2%',
    icon: UsersRound,
    label: 'Patients',
    tone: 'text-emerald-600',
    value: '500.1K',
  },
  {
    change: '-1.2%',
    icon: HeartPulse,
    label: 'Admission growth',
    tone: 'text-rose-600',
    value: '11.3%',
  },
];

const revenueBars = [
  { dark: 58, label: 'January', muted: 54 },
  { dark: 76, label: 'February', muted: 61 },
  { dark: 73, label: 'March', muted: 36 },
  { dark: 36, label: 'April', muted: 58 },
  { dark: 33, label: 'May', muted: 39 },
  { dark: 76, label: 'June', muted: 42 },
];

const activityRows = [
  { department: 'Cardiology', status: 'Stable', value: '84.2%', volume: '1,248' },
  { department: 'Emergency', status: 'High load', value: '92.7%', volume: '3,180' },
  { department: 'Pediatrics', status: 'Normal', value: '71.4%', volume: '928' },
];

function AdminPage() {
  return (
    <section className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.4fr_repeat(3,minmax(0,0.9fr))]">
        <div className="dashboard-card relative min-h-[238px] overflow-hidden p-8">
          <div className="absolute inset-0 opacity-70">
            <div className="absolute top-4 right-6 size-1 rounded-full bg-cyan-400" />
            <div className="absolute top-12 left-7 size-1 rounded-full bg-blue-500" />
            <div className="absolute right-16 bottom-14 size-1 rounded-full bg-rose-400" />
            <div className="absolute bottom-9 left-1/2 size-1 rounded-full bg-emerald-400" />
            <div className="absolute top-16 right-1/3 size-1 rounded-full bg-amber-500" />
          </div>
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div className="space-y-4">
              <Badge className="brand-soft rounded-lg" variant="secondary">
                Admin overview
              </Badge>
              <div>
                <h2 className="text-balance text-3xl font-bold tracking-[-0.04em]">
                  Congratulations Toby! 🎉
                </h2>
                <p className="mt-3 text-muted-foreground">Best operating team of the month</p>
              </div>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="tabular text-4xl font-bold tracking-[-0.05em]">$15,231.89</p>
                <p className="mt-1 text-sm text-emerald-600">+65% from last month</p>
              </div>
              <Button className="h-11 rounded-lg border-cyan-100 bg-white px-6 text-cyan-800 shadow-sm hover:bg-cyan-50" variant="outline">
                View Sales
              </Button>
            </div>
          </div>
        </div>

        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <div key={metric.label} className="dashboard-card flex min-h-[238px] flex-col overflow-hidden">
              <div className="flex flex-1 flex-col justify-between p-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-6">
                    <p className="text-muted-foreground">{metric.label}</p>
                    <p className="tabular text-4xl font-bold tracking-[-0.05em]">{metric.value}</p>
                  </div>
                  <span className={`tabular text-sm font-semibold ${metric.tone}`}>{metric.change}</span>
                </div>
                <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                  <Icon className="size-5" />
                </div>
              </div>
              <button className="flex h-14 items-center justify-end gap-3 border-t border-border px-7 text-sm font-semibold text-cyan-800 transition-colors hover:bg-cyan-50">
                View more
                <ArrowRight className="size-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="dashboard-card p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-[-0.03em]">Total Revenue</h2>
              <p className="mt-2 text-muted-foreground">Income in the last 28 days</p>
            </div>
            <div className="grid grid-cols-2 gap-8 rounded-xl border border-cyan-100 bg-cyan-50/60 px-5 py-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">DESKTOP</p>
                <p className="tabular mt-2 text-3xl font-bold tracking-[-0.05em]">24,828</p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">MOBILE</p>
                <p className="tabular mt-2 text-3xl font-bold tracking-[-0.05em]">25,010</p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex h-[310px] items-end justify-between gap-4 px-1">
            {revenueBars.map((item) => (
              <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-5">
                <div className="flex h-[250px] items-end gap-2">
                  <div
                    className="w-11 rounded-t-xl rounded-b-lg bg-cyan-600"
                    style={{ height: `${item.dark}%` }}
                  />
                  <div
                    className="w-11 rounded-t-xl rounded-b-lg bg-emerald-400"
                    style={{ height: `${item.muted}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-card p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-muted-foreground">Returning Rate</p>
              <div className="mt-3 flex items-center gap-3">
                <p className="tabular text-4xl font-bold tracking-[-0.05em]">$42,379</p>
                <Badge className="success-pill rounded-full" variant="outline">
                  +2.5%
                </Badge>
              </div>
            </div>
            <Button className="h-11 rounded-lg bg-white text-cyan-800 hover:bg-cyan-50" variant="outline">
              <FileUp className="size-4" />
              Export
            </Button>
          </div>

          <div className="mt-8 rounded-xl bg-[linear-gradient(rgba(8,145,178,0.14)_1px,transparent_1px)] bg-[length:100%_65px] pt-6">
            <svg
              aria-label="Returning rate chart"
              className="h-[260px] w-full overflow-visible"
              preserveAspectRatio="none"
              viewBox="0 0 720 260"
            >
              <polyline
                fill="none"
                points="0,200 70,160 140,182 210,105 280,126 350,90 420,183 490,105 560,126 630,90 700,132 720,28"
                stroke="#0891b2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
              <polyline
                fill="none"
                points="0,235 70,196 140,222 210,199 280,219 350,216 420,224 490,200 560,219 630,164 700,182 720,112"
                stroke="#86efac"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
            </svg>
            <div className="grid grid-cols-7 gap-2 text-center text-sm text-muted-foreground">
              {['February', 'March', 'April', 'May', 'June', 'July', 'December'].map((month) => (
                <span key={month}>{month}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <div className="dashboard-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-6">
            <div>
              <h2 className="text-xl font-bold tracking-[-0.03em]">Department Performance</h2>
              <p className="mt-1 text-sm text-muted-foreground">Current operating signals</p>
            </div>
            <ChartNoAxesColumnIncreasing className="size-5 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border">
            {activityRows.map((row) => (
              <div key={row.department} className="grid grid-cols-4 items-center gap-4 px-6 py-4">
                <p className="font-semibold">{row.department}</p>
                <p className="text-sm text-muted-foreground">{row.status}</p>
                <p className="tabular text-sm font-semibold">{row.volume}</p>
                <p className="tabular text-right text-sm font-semibold">{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
              <CalendarCheck className="size-5" />
            </div>
            <div>
              <p className="font-bold">Appointments</p>
              <p className="text-sm text-muted-foreground">2,421 booked this week</p>
            </div>
          </div>
          <div className="mt-6 h-3 rounded-full bg-cyan-50">
            <div className="h-full w-[74%] rounded-full bg-cyan-600" />
          </div>
        </div>

        <div className="dashboard-card p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ClipboardPlus className="size-5" />
            </div>
            <div>
              <p className="font-bold">Care Quality</p>
              <p className="text-sm text-muted-foreground">Audit score improved</p>
            </div>
          </div>
          <div className="mt-6 flex items-end justify-between">
            <p className="tabular text-4xl font-bold tracking-[-0.05em]">98.2%</p>
            <BadgeCheck className="size-9 text-emerald-600" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<LandingPage />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route element={<AppRedirect />} path="/app" />
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>} path="/app">
        <Route element={<AdminPage />} path="admin" />
        <Route element={<SchedulingPage />} path="reception/scheduling" />
        <Route element={<QueuePage />} path="doctor/queue" />
      </Route>
    </Routes>
  );
}
