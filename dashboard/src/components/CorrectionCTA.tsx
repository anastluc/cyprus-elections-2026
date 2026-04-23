import { MessageSquarePlus, ArrowRight } from 'lucide-react';
import { useUI } from '../lib/store';
import { useT } from '../lib/i18n';

export function CorrectionCTA({ variant = 'card' }: { variant?: 'card' | 'inline' }) {
  const setSection = useUI((s) => s.setActiveSection);
  const t = useT();

  if (variant === 'inline') {
    return (
      <button
        onClick={() => setSection('correction')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-300 hover:text-brand-200"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        {t('cta_inline')}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-r from-brand-500/10 via-fuchsia-500/5 to-transparent p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-500/20 text-brand-200">
            <MessageSquarePlus className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">
              {t('cta_card_title')}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
              {t('cta_card_body')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setSection('correction')}
          className="inline-flex flex-none items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white transition hover:bg-white/[0.08]"
        >
          {t('cta_card_button')}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
