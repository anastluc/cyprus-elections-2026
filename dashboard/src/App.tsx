import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Briefcase,
  Database,
  Github,
  Globe2,
  GraduationCap,
  LayoutDashboard,
  MessageSquarePlus,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
  Vote,
} from 'lucide-react';
import { Disclaimer } from './components/Disclaimer';
import { LocaleSwitch } from './components/LocaleSwitch';
import { loadDataset } from './data/load';
import type { Dataset } from './data/types';
import { cn } from './lib/utils';
import { useUI, type Section } from './lib/store';
import { useDataset } from './data/store';
import { useT, type TKey } from './lib/i18n';
import { Overview } from './pages/Overview';
import { Demographics } from './pages/Demographics';
import { Parties } from './pages/Parties';
import { Professions } from './pages/Professions';
import { Education } from './pages/Education';
import { Digital } from './pages/Digital';
import { Highlights } from './pages/Highlights';
import { Timeline } from './pages/Timeline';
import { Explorer } from './pages/Explorer';
import { DataQuality } from './pages/DataQuality';
import { CandidateProfile } from './pages/CandidateProfile';
import { SubmitCorrection } from './pages/SubmitCorrection';

const NAV: { id: Section; labelKey: TKey; icon: typeof Activity }[] = [
  { id: 'overview', labelKey: 'nav_overview', icon: LayoutDashboard },
  { id: 'demographics', labelKey: 'nav_demographics', icon: Users },
  { id: 'parties', labelKey: 'nav_parties', icon: Vote },
  { id: 'professions', labelKey: 'nav_professions', icon: Briefcase },
  { id: 'education', labelKey: 'nav_education', icon: GraduationCap },
  { id: 'digital', labelKey: 'nav_digital', icon: Globe2 },
  { id: 'highlights', labelKey: 'nav_highlights', icon: Sparkles },
  { id: 'timeline', labelKey: 'nav_timeline', icon: Timer },
  { id: 'explorer', labelKey: 'nav_explorer', icon: Database },
  { id: 'quality', labelKey: 'nav_quality', icon: ShieldCheck },
  { id: 'correction', labelKey: 'nav_correction', icon: MessageSquarePlus },
];

export default function App() {
  const data = useDataset((s) => s.data);
  const error = useDataset((s) => s.error);
  const setData = useDataset((s) => s.setData);
  const setError = useDataset((s) => s.setError);
  const section = useUI((s) => s.activeSection);
  const setSection = useUI((s) => s.setActiveSection);
  const t = useT();

  useEffect(() => {
    loadDataset()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [setData, setError]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="max-w-md rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
          <h1 className="text-lg font-semibold text-rose-200">
            {t('error_title')}
          </h1>
          <p className="mt-2 text-sm text-rose-100/80">{error}</p>
          <p className="mt-3 font-mono text-xs text-rose-200/70">
            {t('error_hint')} <code>uv run cyprus-elections export --format dashboard</code>
          </p>
        </div>
      </div>
    );
  }

  if (!data) return <Loading />;

  return (
    <div className="min-h-full">
      <Disclaimer />
      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:py-8">
        <SideNav section={section} setSection={setSection} />
        <main className="min-w-0 flex-1 space-y-24 pb-24">
          <TopHeader meta={data.meta} />
          <Panel active={section === 'overview'}><Overview data={data} /></Panel>
          <Panel active={section === 'demographics'}><Demographics data={data} /></Panel>
          <Panel active={section === 'parties'}><Parties data={data} /></Panel>
          <Panel active={section === 'professions'}><Professions data={data} /></Panel>
          <Panel active={section === 'education'}><Education data={data} /></Panel>
          <Panel active={section === 'digital'}><Digital data={data} /></Panel>
          <Panel active={section === 'highlights'}><Highlights data={data} /></Panel>
          <Panel active={section === 'timeline'}><Timeline data={data} /></Panel>
          <Panel active={section === 'explorer'}><Explorer data={data} /></Panel>
          <Panel active={section === 'quality'}><DataQuality data={data} /></Panel>
          <Panel active={section === 'profile'}><CandidateProfile data={data} /></Panel>
          <Panel active={section === 'correction'}><SubmitCorrection data={data} /></Panel>
          <Footer meta={data.meta} />
        </main>
      </div>
      <MobileNav section={section} setSection={setSection} />
    </div>
  );
}

function Panel({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  if (!active) return null;
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="scroll-mt-24"
    >
      {children}
    </motion.section>
  );
}

function SideNav({
  section,
  setSection,
}: {
  section: Section;
  setSection: (s: Section) => void;
}) {
  const t = useT();
  return (
    <aside className="sticky top-24 hidden h-fit w-56 flex-none lg:block">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 backdrop-blur-md">
        <div className="px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t('sidebar_label')}
          </div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const Icon = n.icon;
            const on = section === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setSection(n.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition',
                  on
                    ? 'bg-gradient-to-r from-brand-500/30 to-fuchsia-500/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                )}
              >
                <Icon className={cn('h-4 w-4', on ? 'text-brand-200' : '')} />
                {t(n.labelKey) as string}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

function MobileNav({
  section,
  setSection,
}: {
  section: Section;
  setSection: (s: Section) => void;
}) {
  const t = useT();
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-slate-950/85 backdrop-blur-md lg:hidden">
      <div className="flex overflow-x-auto px-2">
        {NAV.map((n) => {
          const Icon = n.icon;
          const on = section === n.id;
          return (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              className={cn(
                'flex min-w-[76px] flex-col items-center gap-0.5 px-2 py-2 text-[10px]',
                on ? 'text-brand-200' : 'text-slate-400'
              )}
            >
              <Icon className="h-4 w-4" />
              {t(n.labelKey) as string}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TopHeader({ meta }: { meta: Dataset['meta'] }) {
  const t = useT();
  const election = new Date(meta.election_date);
  const days = Math.max(
    0,
    Math.ceil((election.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  const title = t('header_title_html');
  const [titleHead, titleTail] = splitHeaderTitle(title);
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-rose-500 text-2xl shadow-lg shadow-indigo-500/30">
            🇨🇾
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-300">
              {t('header_eyebrow')}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              <span className="gradient-text">{titleHead}</span>
              {titleTail}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs text-brand-200">
            <Activity className="h-3.5 w-3.5 animate-pulse" />
            {t('header_countdown')(days)}
          </div>
          <a
            href="https://github.com/anastluc/cyprus-elections-2026"
            target="_blank"
            rel="noopener noreferrer"
            title="View source on GitHub"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <Github className="h-4 w-4" />
          </a>
          <LocaleSwitch />
        </div>
      </div>
      <div className="hairline" />
    </header>
  );
}

function splitHeaderTitle(title: string): [string, string] {
  const dashIndex = title.indexOf('—');
  if (dashIndex === -1) return [title, ''];
  return [title.slice(0, dashIndex).trim(), ' ' + title.slice(dashIndex)];
}

function Footer({ meta }: { meta: Dataset['meta'] }) {
  const t = useT();
  return (
    <footer className="border-t border-white/5 pt-6 text-xs text-slate-500">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <span>
          {t('footer_generated')}{' '}
          <span className="text-slate-300">{new Date(meta.generated_at).toLocaleString()}</span>
        </span>
        <span>{t('footer_counts')(meta.total_candidates, meta.total_sources)}</span>
        <a
          href="https://github.com/anastluc/cyprus-elections-2026"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1.5 text-slate-500 transition hover:text-slate-300"
        >
          <Github className="h-3.5 w-3.5" />
          anastluc/cyprus-elections-2026
        </a>
      </div>
    </footer>
  );
}

function Loading() {
  const t = useT();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-brand-500/20 border-t-brand-400" />
      <div className="text-sm text-slate-400">{t('loading')}</div>
    </div>
  );
}
