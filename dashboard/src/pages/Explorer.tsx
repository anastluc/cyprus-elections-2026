import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, X, ExternalLink } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import { PartyBadge } from '../components/PartyBadge';
import { districtLabel, PARTY_ORDER, partyLabel } from '../lib/theme';
import type { Candidate, Dataset } from '../data/types';
import { isFemale, isMale } from '../lib/utils';
import { useFilters, useUI } from '../lib/store';
import { CorrectionCTA } from '../components/CorrectionCTA';

const DISTRICTS = ['NIC', 'LIM', 'LAR', 'FAM', 'PAF', 'KYR'];
const PLATFORM_OPTIONS = ['facebook', 'twitter', 'instagram', 'linkedin', 'website', 'wikipedia'];

export function Explorer({ data }: { data: Dataset }) {
  const filters = useFilters();
  const {
    party,
    district,
    gender,
    cluster,
    profession,
    education,
    platform,
    search,
    setParty,
    setDistrict,
    setGender,
    setCluster,
    setProfession,
    setEducation,
    setPlatform,
    setSearch,
    reset,
  } = filters;

  const [localSearch, setLocalSearch] = useState(search);
  useEffect(() => setLocalSearch(search), [search]);
  useEffect(() => {
    const t = setTimeout(() => setSearch(localSearch), 150);
    return () => clearTimeout(t);
  }, [localSearch, setSearch]);

  const openProfile = useUI((s) => s.openProfile);
  const [sorting, setSorting] = useState<SortingState>([]);

  const fuse = useMemo(
    () =>
      new Fuse(data.candidates, {
        keys: ['name_en', 'name_gr', 'fields.profession.value', 'fields.education.value'],
        threshold: 0.3,
      }),
    [data.candidates]
  );

  const professionOptions = useMemo(() => {
    const c = new Map<string, number>();
    for (const x of data.candidates) {
      const p = x.fields.profession?.value;
      if (!p) continue;
      c.set(p, (c.get(p) ?? 0) + 1);
    }
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).map((e) => e[0]);
  }, [data.candidates]);

  const clusterOptions = useMemo(
    () => Object.keys(data.stats.by_cluster).sort(),
    [data.stats.by_cluster]
  );

  const filtered = useMemo(() => {
    let pool = data.candidates;
    if (search) pool = fuse.search(search).map((r) => r.item);
    if (party) pool = pool.filter((c) => c.party === party);
    if (district) pool = pool.filter((c) => c.district === district);
    if (gender)
      pool = pool.filter((c) =>
        gender === 'female' ? isFemale(c.fields.gender?.value) : isMale(c.fields.gender?.value)
      );
    if (cluster) pool = pool.filter((c) => c.fields.profession_cluster?.value === cluster);
    if (profession) {
      const needle = profession.toLowerCase();
      pool = pool.filter((c) => (c.fields.profession?.value ?? '').toLowerCase().includes(needle));
    }
    if (education) {
      const needle = education.toLowerCase();
      pool = pool.filter((c) => (c.fields.education?.value ?? '').toLowerCase().includes(needle));
    }
    if (platform) pool = pool.filter((c) => !!c.fields[platform]?.value);
    return pool;
  }, [data.candidates, fuse, search, party, district, gender, cluster, profession, education, platform]);

  const h = createColumnHelper<Candidate>();
  const cols = [
    h.accessor('name_en', {
      header: 'Name',
      cell: (info) => (
        <div>
          <div className="text-slate-100">{info.getValue()}</div>
          <div className="text-[10px] text-slate-500">{info.row.original.name_gr}</div>
        </div>
      ),
    }),
    h.accessor('party', {
      header: 'Party',
      cell: (info) => <PartyBadge code={info.getValue()} size="sm" />,
    }),
    h.accessor('district', {
      header: 'District',
      cell: (info) =>
        info.getValue() ? districtLabel(info.getValue() as string) : '—',
    }),
    h.accessor((c) => c.fields.gender?.value ?? '', {
      id: 'gender',
      header: 'Gender',
      cell: (info) => {
        const v = String(info.getValue() ?? '');
        if (isFemale(v)) return 'Female';
        if (isMale(v)) return 'Male';
        return v;
      },
    }),
    h.accessor((c) => c.age ?? 0, {
      id: 'age',
      header: 'Age',
      cell: (info) =>
        info.getValue() ? <span className="font-mono">{info.getValue()}</span> : '—',
    }),
    h.accessor((c) => c.fields.profession_cluster?.value ?? '', {
      id: 'cluster',
      header: 'Cluster',
    }),
    h.accessor('row_confidence', {
      header: 'Conf.',
      cell: (info) => (
        <span
          className={`font-mono text-xs ${
            info.getValue() >= 0.75
              ? 'text-emerald-300'
              : info.getValue() >= 0.5
                ? 'text-amber-300'
                : 'text-rose-300'
          }`}
        >
          {(info.getValue() * 100).toFixed(0)}
        </span>
      ),
    }),
  ];

  const table = useReactTable({
    data: filtered,
    columns: cols,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const activeFilters: { label: string; clear: () => void }[] = [];
  if (party) activeFilters.push({ label: `Party: ${partyLabel(party)}`, clear: () => setParty(null) });
  if (district) activeFilters.push({ label: `District: ${districtLabel(district)}`, clear: () => setDistrict(null) });
  if (gender) activeFilters.push({ label: `Gender: ${gender}`, clear: () => setGender(null) });
  if (cluster) activeFilters.push({ label: `Cluster: ${cluster}`, clear: () => setCluster(null) });
  if (profession) activeFilters.push({ label: `Profession: ${profession}`, clear: () => setProfession(null) });
  if (education) activeFilters.push({ label: `Education: ${education}`, clear: () => setEducation(null) });
  if (platform) activeFilters.push({ label: `Has ${platform}`, clear: () => setPlatform(null) });

  return (
    <div>
      <SectionHeader
        eyebrow="Explorer"
        title="Every candidate, every field"
        subtitle="Click any row to open the full profile. Filters mirror the ones applied from other tabs."
        action={
          activeFilters.length > 0 ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/20 hover:bg-white/10"
            >
              Clear filters <X className="h-3 w-3" />
            </button>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search name / profession / education…"
          className="col-span-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand-400/50 lg:col-span-2"
        />
        <Select
          value={party}
          onChange={setParty}
          options={PARTY_ORDER.map((p) => ({ v: p, label: partyLabel(p) }))}
          placeholder="All parties"
        />
        <Select
          value={district}
          onChange={setDistrict}
          options={DISTRICTS.map((d) => ({ v: d, label: districtLabel(d) }))}
          placeholder="All districts"
        />
        <Select
          value={gender}
          onChange={setGender}
          options={[
            { v: 'male', label: 'Men' },
            { v: 'female', label: 'Women' },
          ]}
          placeholder="Any gender"
        />
        <Select
          value={cluster}
          onChange={setCluster}
          options={clusterOptions.map((c) => ({ v: c, label: c }))}
          placeholder="Any cluster"
        />
        <Select
          value={platform}
          onChange={setPlatform}
          options={PLATFORM_OPTIONS.map((p) => ({ v: p, label: `Has ${p}` }))}
          placeholder="Any platform"
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <TextFilter
          value={profession}
          onChange={setProfession}
          placeholder="Profession contains…"
          suggestions={professionOptions}
        />
        <TextFilter
          value={education}
          onChange={setEducation}
          placeholder="Education contains (e.g. Harvard, Νομική, PhD)…"
        />
      </div>

      {activeFilters.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {activeFilters.map((f, i) => (
            <button
              key={i}
              type="button"
              onClick={f.clear}
              className="inline-flex items-center gap-1 rounded-full border border-brand-400/30 bg-brand-500/10 px-2.5 py-0.5 text-[11px] text-brand-100 transition hover:border-brand-400/50 hover:bg-brand-500/20"
            >
              {f.label} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="mb-2 text-xs text-slate-500">
        Showing <span className="text-slate-200">{filtered.length}</span> of {data.candidates.length} candidates.
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="max-h-[640px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-white/10">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="cursor-pointer select-none px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-white"
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      </span>
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => openProfile(row.original.id)}
                  className="cursor-pointer border-b border-white/5 transition hover:bg-white/[0.04]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right">
                    <ExternalLink className="inline h-3.5 w-3.5 text-slate-500" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <CorrectionCTA variant="card" />
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: { v: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-400/50"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function TextFilter({
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
  suggestions?: string[];
}) {
  return (
    <div className="relative">
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
        list={suggestions ? 'sugg' : undefined}
        className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand-400/50"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/5 p-1 text-slate-400 hover:text-white"
          aria-label="Clear"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
      {suggestions ? (
        <datalist id="sugg">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}
