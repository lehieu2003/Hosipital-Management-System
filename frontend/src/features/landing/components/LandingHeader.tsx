import { GalleryVerticalEnd } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { resolveHomePath, useAuth } from '@/features/auth';

export function LandingHeader() {
  const { session } = useAuth();
  const primaryHref = session ? resolveHomePath(session.role) : '/login';
  const primaryLabel = session ? 'Open workspace' : 'Sign in';

  return (
    <header className="sticky top-0 z-30 border-b border-white/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-3" to="/">
          <div className="brand-mark flex size-10 items-center justify-center rounded-2xl shadow-sm">
            <GalleryVerticalEnd className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-cyan-800">MediCore HMS</p>
            <p className="text-xs text-muted-foreground">OPD operations</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex">
          <a className="transition-colors hover:text-foreground" href="#overview">Overview</a>
          <a className="transition-colors hover:text-foreground" href="#roles">Roles</a>
          <a className="transition-colors hover:text-foreground" href="#workflow">Workflow</a>
          <a className="transition-colors hover:text-foreground" href="#reliability">Reliability</a>
        </nav>

        <div className="flex items-center gap-3">
          <Button asChild className="hidden rounded-xl bg-white px-4 text-cyan-800 shadow-none hover:bg-cyan-50 sm:inline-flex" variant="outline">
            <a href="#workflow">View workflow</a>
          </Button>
          <Button asChild className="brand-button rounded-xl px-5">
            <Link to={primaryHref}>{primaryLabel}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
