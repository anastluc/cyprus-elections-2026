import type { ReactNode } from 'react';

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-300">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-400 sm:text-base">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
