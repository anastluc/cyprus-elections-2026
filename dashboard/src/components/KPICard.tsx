import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';

export function KPICard({
  label,
  value,
  suffix,
  accent = 'brand',
  icon,
  hint,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: 'brand' | 'rose' | 'amber' | 'emerald';
  icon?: ReactNode;
  hint?: string;
}) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: 1400, bounce: 0 });
  const rounded = useTransform(spring, (v) =>
    Number.isFinite(v) ? Math.round(v).toLocaleString('en-GB') : '0'
  );
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);

  const accents: Record<string, string> = {
    brand: 'from-indigo-500/30 to-fuchsia-500/10',
    rose: 'from-rose-500/30 to-amber-500/10',
    amber: 'from-amber-500/30 to-rose-500/10',
    emerald: 'from-emerald-500/25 to-teal-500/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md"
    >
      <div
        className={`pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-gradient-to-br ${accents[accent]} blur-2xl`}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
            {label}
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <motion.span className="font-mono text-4xl font-bold tracking-tight text-white">
              {rounded}
            </motion.span>
            {suffix ? (
              <span className="text-lg text-slate-400">{suffix}</span>
            ) : null}
          </div>
          {hint ? (
            <div className="mt-1 text-xs text-slate-500">{hint}</div>
          ) : null}
        </div>
        {icon ? <div className="text-slate-500">{icon}</div> : null}
      </div>
    </motion.div>
  );
}
