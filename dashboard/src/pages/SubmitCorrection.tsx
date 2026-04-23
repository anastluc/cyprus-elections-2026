import { ExternalLink, MessageSquarePlus, ShieldCheck, Clock3 } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import type { Dataset } from '../data/types';
import { useT } from '../lib/i18n';

export function SubmitCorrection({ data }: { data: Dataset }) {
  const sheetUrl = data.meta.correction_sheet_url;
  const t = useT();

  return (
    <div>
      <SectionHeader
        eyebrow={t('sc_eyebrow')}
        title={t('sc_title')}
        subtitle={<>{t('sc_subtitle')}</>}
      />

      {sheetUrl ? (
        <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 via-fuchsia-500/5 to-transparent p-6 sm:p-8">
          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:brightness-110"
          >
            <MessageSquarePlus className="h-4 w-4" />
            {t('sc_button')}
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </a>
          <p className="mt-3 text-xs text-slate-400">{t('sc_button_note')}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-100">
          {t('sc_not_ready')}
        </div>
      )}

      <div className="mt-10">
        <h3 className="mb-4 text-lg font-semibold text-white">{t('sc_how_title')}</h3>
        <ol className="space-y-4">
          <Step num={1} title={t('sc_step1_title')} body={t('sc_step1_body')} />
          <Step num={2} title={t('sc_step2_title')} body={t('sc_step2_body')} />
          <Step
            num={3}
            title={t('sc_step3_title')}
            body={
              <>
                {t('sc_step3_body')}
                <span className="mt-2 block rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 font-mono text-xs text-slate-200">
                  {t('sc_step3_example')}
                </span>
              </>
            }
          />
          <Step num={4} title={t('sc_step4_title')} body={t('sc_step4_body')} />
        </ol>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InfoCard
          icon={ShieldCheck}
          title={t('sc_info1_title')}
          body={t('sc_info1_body')}
        />
        <InfoCard
          icon={MessageSquarePlus}
          title={t('sc_info2_title')}
          body={t('sc_info2_body')}
        />
        <InfoCard
          icon={Clock3}
          title={t('sc_info3_title')}
          body={t('sc_info3_body')}
        />
      </div>

      <p className="mt-10 text-xs text-slate-500">{t('sc_footer')}</p>
    </div>
  );
}

function Step({
  num,
  title,
  body,
}: {
  num: number;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-500/20 text-sm font-semibold text-brand-200">
        {num}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="mt-1 text-sm leading-relaxed text-slate-400">{body}</div>
      </div>
    </li>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <Icon className="h-5 w-5 text-brand-300" />
      <div className="mt-3 text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}
