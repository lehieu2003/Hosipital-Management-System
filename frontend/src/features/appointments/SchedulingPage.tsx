import { CalendarDays, ShieldAlert, Stethoscope } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const planningNotes = [
  {
    copy: 'Use live backend contracts only. No speculative patient fields or unsupported actions.',
    icon: CalendarDays,
    label: 'Next step',
    title: 'Wire patient search and doctor selection',
  },
  {
    copy: 'Unavailable or conflicting appointment state should halt the workflow instead of falling back to stale data.',
    icon: ShieldAlert,
    label: 'Failure mode',
    title: 'Fail closed on API degradation',
  },
  {
    copy: 'The current layout already leaves room for booking context, patient identity, and slot availability signals.',
    icon: Stethoscope,
    label: 'Design intent',
    title: 'Ready for operational form density',
  },
];

export function SchedulingPage() {
  return (
    <section className="space-y-6">
      <Card className="border-primary/10 bg-background/90 shadow-sm">
        <CardHeader className="gap-3">
          <Badge variant="secondary">Receptionist</Badge>
          <div className="space-y-2">
            <CardTitle className="text-balance text-3xl">Scheduling shell</CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7">
              Appointment booking UI lands next. This route exists now so auth boundaries,
              layout density, and the reception workflow entry point stay stable.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {planningNotes.map((note) => {
          const Icon = note.icon;

          return (
            <Card key={note.title} className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader className="gap-4">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="space-y-2">
                  <Badge className="w-fit" variant="outline">
                    {note.label}
                  </Badge>
                  <CardTitle className="text-xl">{note.title}</CardTitle>
                  <CardDescription className="text-sm leading-6">{note.copy}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                  This slot is reserved for the live scheduling form once the appointment contract is ready.
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
