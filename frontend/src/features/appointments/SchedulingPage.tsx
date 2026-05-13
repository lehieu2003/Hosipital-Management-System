const planningNotes = [
  {
    copy: 'Use live backend contracts only. No speculative fields or unsupported actions.',
    label: 'Next step',
    title: 'Wire patient search and doctor selection',
  },
  {
    copy: 'Unavailable or conflicting appointment state should stop action clearly instead of falling back to stale data.',
    label: 'Failure mode',
    title: 'Fail closed on API degradation',
  },
  {
    copy: 'The current layout already leaves room for booking context, patient identity, and slot availability signals.',
    label: 'Design intent',
    title: 'Ready for operational form density',
  },
]

export function SchedulingPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[var(--shadow-panel)] backdrop-blur sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-600">
          Receptionist
        </p>
        <h1 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Scheduling shell
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Appointment booking UI lands next. This route exists now so auth boundaries, layout
          density, and the reception workflow entry point are already stable.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {planningNotes.map((note) => (
          <article
            key={note.title}
            className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-[var(--shadow-soft)]"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-600">
              {note.label}
            </p>
            <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900">
              {note.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{note.copy}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
