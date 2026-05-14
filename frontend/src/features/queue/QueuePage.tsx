import { Activity, RefreshCw, ShieldBan } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const queueNotes = [
  {
    copy: 'Awaiting appointment queue endpoints before wiring live patient cards and timeline state.',
    icon: Activity,
    title: 'Current scope',
  },
  {
    copy: 'Refresh on interval and focus, replay once after token refresh, then fail closed on unavailable state.',
    icon: RefreshCw,
    title: 'Required later behavior',
  },
  {
    copy: 'The card rhythm and spacing are set up for queue priority, patient details, and action buttons.',
    icon: ShieldBan,
    title: 'Visual contract',
  },
];

export function QueuePage() {
  return (
    <section className="space-y-6">
      <Card className="border-primary/10 bg-background/90 shadow-sm">
        <CardHeader className="gap-3">
          <Badge variant="secondary">Doctor</Badge>
          <div className="space-y-2">
            <CardTitle className="text-balance text-3xl">Queue shell</CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7">
              Queue polling and appointment progression land next. This page keeps the route,
              navigation, and workspace proportions stable so live data can drop in cleanly.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {queueNotes.map((note, index) => {
          const Icon = note.icon;

          return (
            <Card key={note.title} className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader className="gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <Badge variant="outline">0{index + 1}</Badge>
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-xl">{note.title}</CardTitle>
                  <CardDescription className="text-sm leading-6">{note.copy}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                  Future queue rows, status controls, and refresh diagnostics render here.
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
