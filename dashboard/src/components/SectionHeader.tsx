import type { ReactNode } from 'react';

/**
 * Swiss-style section header — light heading weight, narrow subtitle column,
 * caption-style eyebrow, hairline separator beneath. Generous bottom margin.
 */
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
    <div className="mb-10 border-b border-stone-200 pb-6 dark:border-stone-800 sm:mb-12 sm:pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? (
            <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-900/60 dark:text-stone-50/60">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="text-3xl font-light leading-tight tracking-tight text-balance text-stone-900 dark:text-stone-50 sm:text-4xl md:text-5xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-pretty text-stone-900/70 dark:text-stone-50/70 sm:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
