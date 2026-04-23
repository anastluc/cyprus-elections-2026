import { useUI } from '../lib/store';
import { useT } from '../lib/i18n';
import { cn } from '../lib/utils';

export function LocaleSwitch() {
  const locale = useUI((s) => s.locale);
  const setLocale = useUI((s) => s.setLocale);
  const t = useT();

  return (
    <div
      role="group"
      aria-label={t('locale_switch_aria')}
      className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-0.5 text-[11px] font-semibold"
    >
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={cn(
          'rounded-full px-2.5 py-1 transition',
          locale === 'en'
            ? 'bg-white/10 text-white'
            : 'text-slate-400 hover:text-slate-200',
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale('gr')}
        className={cn(
          'rounded-full px-2.5 py-1 transition',
          locale === 'gr'
            ? 'bg-white/10 text-white'
            : 'text-slate-400 hover:text-slate-200',
        )}
      >
        GR
      </button>
    </div>
  );
}
