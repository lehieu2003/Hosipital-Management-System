type SectionHeadingProps = {
  description: string;
  eyebrow: string;
  title: string;
};

export function SectionHeading({ description, eyebrow, title }: SectionHeadingProps) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {eyebrow}
      </p>
      <div className="space-y-1.5">
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
        <p className="max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
