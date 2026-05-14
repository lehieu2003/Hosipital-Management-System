import { Badge } from '@/components/ui/badge';

type SectionIntroProps = {
  badgeVariant?: 'secondary' | 'outline';
  body: string;
  eyebrow: string;
  title: string;
};

export function SectionIntro({
  badgeVariant = 'outline',
  body,
  eyebrow,
  title,
}: SectionIntroProps) {
  return (
    <div className="max-w-2xl space-y-3 md:space-y-4">
      <Badge
        className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
        variant={badgeVariant}
      >
        {eyebrow}
      </Badge>
      <h2 className="text-balance text-3xl font-semibold tracking-[-0.04em] text-slate-950 md:text-4xl">
        {title}
      </h2>
      <p className="text-pretty text-base leading-7 text-muted-foreground md:text-[1.05rem]">
        {body}
      </p>
    </div>
  );
}
