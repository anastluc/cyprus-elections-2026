import { ResponsiveTreeMap } from '@nivo/treemap';
import { SectionHeader } from '../components/SectionHeader';
import { CLUSTER_COLOURS, NIVO_THEME, clusterColour } from '../lib/theme';
import type { Dataset } from '../data/types';
import { useFilters, useUI } from '../lib/store';

export function Professions({ data }: { data: Dataset }) {
  const { stats, candidates } = data;
  const clusters = Object.entries(stats.by_cluster).sort((a, b) => b[1] - a[1]);
  const setFilters = useFilters((s) => s.setMany);
  const resetFilters = useFilters((s) => s.reset);
  const setSection = useUI((s) => s.setActiveSection);

  function openExplorer(patch: { cluster?: string | null; profession?: string | null }) {
    resetFilters();
    setFilters(patch);
    setSection('explorer');
  }

  const byCluster: Record<string, string[]> = {};
  for (const c of candidates) {
    const cl = c.fields.profession_cluster?.value ?? 'Other';
    const prof = c.fields.profession?.value;
    if (!prof) continue;
    byCluster[cl] ??= [];
    byCluster[cl].push(prof);
  }

  const tree = {
    name: 'All',
    children: clusters.map(([name, count]) => {
      const leafs = countOccurrences(byCluster[name] ?? []);
      return {
        name,
        color: clusterColour(name),
        children: Object.entries(leafs)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([leaf, c]) => ({ name: leaf, cluster: name, value: c, color: clusterColour(name) })),
        _aggregate: count,
      };
    }),
  };

  const topProfessions = Object.entries(mergeAll(byCluster))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return (
    <div>
      <SectionHeader
        eyebrow="Professions"
        title="What do candidates do for a living?"
        subtitle="Free-text profession titles clustered by LLM into 15 categories. Click any tile, bar, or top-title to open the Explorer filtered."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Treemap
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">
            Clustered professions
          </h3>
          <div className="h-[480px]">
            <ResponsiveTreeMap
              data={tree}
              identity="name"
              value="value"
              theme={NIVO_THEME}
              colors={(n) => (n.data as { color?: string }).color ?? '#6366f1'}
              leavesOnly={false}
              innerPadding={3}
              outerPadding={3}
              borderWidth={0}
              labelSkipSize={18}
              labelTextColor="#ffffff"
              parentLabelTextColor="#f1f5f9"
              parentLabelSize={14}
              parentLabelPadding={8}
              orientLabel={false}
              animate={false}
              onClick={(node) => {
                const d = (node as { data?: { name?: string; cluster?: string; children?: unknown } }).data;
                if (!d) return;
                if (d.children) {
                  openExplorer({ cluster: d.name ?? null });
                } else {
                  openExplorer({ cluster: d.cluster ?? null, profession: d.name ?? null });
                }
              }}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Cluster ranking
            </div>
            <h3 className="mb-3 text-lg font-semibold text-white">
              Candidates per category
            </h3>
            <div className="space-y-2">
              {clusters.map(([name, count]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => openExplorer({ cluster: name })}
                  className="group block w-full rounded-lg text-left transition hover:bg-white/[0.03]"
                >
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-200">{name}</span>
                    <span className="font-mono text-slate-400">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(count / (clusters[0]?.[1] ?? 1)) * 100}%`,
                        background: CLUSTER_COLOURS[name] ?? '#6366f1',
                        boxShadow: `0 0 10px ${CLUSTER_COLOURS[name] ?? '#6366f1'}66`,
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Top 12 free-text titles
            </div>
            <h3 className="mb-3 text-lg font-semibold text-white">
              Most common backgrounds
            </h3>
            <ul className="space-y-1.5 text-sm">
              {topProfessions.map(([title, count]) => (
                <li key={title} className="border-b border-white/5 pb-1.5">
                  <button
                    type="button"
                    onClick={() => openExplorer({ profession: title })}
                    className="flex w-full items-baseline justify-between gap-3 text-left transition hover:text-brand-200"
                  >
                    <span className="truncate text-slate-200">{title}</span>
                    <span className="font-mono text-xs text-slate-400">{count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function countOccurrences(arr: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of arr) {
    const key = v.trim();
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function mergeAll(map: Record<string, string[]>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const arr of Object.values(map))
    for (const v of arr) {
      const key = v.trim();
      out[key] = (out[key] ?? 0) + 1;
    }
  return out;
}
