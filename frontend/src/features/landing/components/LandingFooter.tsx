import { GalleryVerticalEnd } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LandingFooter() {
  return (
    <footer className="border-t border-white/70 bg-white/80 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="brand-mark flex size-9 items-center justify-center rounded-2xl shadow-sm">
            <GalleryVerticalEnd className="size-4" />
          </div>
          <p>MediCore HMS · OPD foundation for calm, role-safe hospital workflows.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link className="transition-colors hover:text-foreground" to="/login">Login</Link>
          <a className="transition-colors hover:text-foreground" href="#reliability">Reliability</a>
          <span>Operational status stays explicit by design.</span>
        </div>
      </div>
    </footer>
  );
}
