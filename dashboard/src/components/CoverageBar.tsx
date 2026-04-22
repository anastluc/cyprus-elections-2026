import { motion } from 'framer-motion';

export function CoverageBar({
  label,
  count,
  total,
  accent,
}: {
  label: string;
  count: number;
  total: number;
  accent?: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const bg = accent ?? '#6366f1';
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="tabular-nums text-slate-400">
          <span className="font-mono text-slate-100">{pct.toFixed(0)}%</span>
          <span className="ml-1.5 text-slate-500">{count}/{total}</span>
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${bg}aa, ${bg})`,
            boxShadow: `0 0 12px ${bg}66`,
          }}
        />
      </div>
    </div>
  );
}
