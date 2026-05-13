const queueNotes = [
  {
    copy: 'Awaiting appointment queue endpoints before wiring live patient cards and timeline state.',
    title: 'Current scope',
  },
  {
    copy: 'Refresh on interval and focus, replay once after token refresh, then fail closed on unavailable state.',
    title: 'Required later behavior',
  },
  {
    copy: 'The card rhythm and side spacing are set up for queue priority, patient details, and action buttons.',
    title: 'Visual contract',
  },
]

export function QueuePage() {
  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[var(--shadow-panel)] backdrop-blur sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-600">Doctor</p>
        <h1 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Queue shell
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Queue polling and appointment progression land next. This page preserves the route,
          navigation, and clinical workspace proportions now so later live data can drop in cleanly.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {queueNotes.map((note, index) => (
          <article
            key={note.title}
            className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-6 shadow-[var(--shadow-soft)]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-mint-50 text-sm font-bold text-brand-700">
              0{index + 1}
            </div>
            <strong className="mt-4 block text-xl font-bold tracking-tight text-slate-900">
              {note.title}
            </strong>
            <p className="mt-3 text-sm leading-6 text-slate-600">{note.copy}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
