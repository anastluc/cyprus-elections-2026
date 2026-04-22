import { useMemo, useState } from 'react';
import { useFilters } from '../lib/store';
import { DISTRICT_LABELS, DISTRICT_SEATS } from '../lib/theme';

type DistrictKey = 'NIC' | 'LIM' | 'FAM' | 'LAR' | 'PAF' | 'KYR';

// Rough, stylised island outline + district centroids. Not geodesically correct —
// tuned to read as "Cyprus-shaped" at dashboard size.
const ISLAND_PATH =
  'M30,150 C60,110 120,90 175,90 C220,88 260,78 305,80 C360,82 410,95 445,120 C468,135 475,160 455,175 C430,195 395,200 355,200 C320,205 285,210 250,215 C210,220 165,225 130,225 C90,225 55,200 35,180 C25,170 22,160 30,150 Z';

const CITY: Record<DistrictKey, { x: number; y: number }> = {
  NIC: { x: 260, y: 140 }, // Nicosia, central
  LIM: { x: 205, y: 190 }, // Limassol, south coast
  LAR: { x: 310, y: 175 }, // Larnaca, south-east
  FAM: { x: 380, y: 125 }, // Famagusta, east
  PAF: { x: 100, y: 175 }, // Paphos, west
  KYR: { x: 245, y: 95 },  // Kyrenia, north of Nicosia
};

const DISTRICT_KEYS: DistrictKey[] = ['NIC', 'LIM', 'LAR', 'FAM', 'PAF', 'KYR'];

export function CyprusMap({ byDistrict }: { byDistrict: Record<string, number> }) {
  const [view, setView] = useState<'geo' | 'grid'>('geo');
  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setView('geo')}
          className={tabClass(view === 'geo')}
        >
          Geographic
        </button>
        <button
          type="button"
          onClick={() => setView('grid')}
          className={tabClass(view === 'grid')}
        >
          Seat grid
        </button>
      </div>
      {view === 'geo' ? <GeoView byDistrict={byDistrict} /> : <GridView byDistrict={byDistrict} />}
    </div>
  );
}

function tabClass(active: boolean): string {
  return active
    ? 'rounded-full border border-brand-400/50 bg-brand-500/15 px-3 py-1 text-xs text-brand-100'
    : 'rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 transition hover:bg-white/10';
}

function GeoView({ byDistrict }: { byDistrict: Record<string, number> }) {
  const { district, setDistrict } = useFilters();
  const max = Math.max(1, ...Object.values(byDistrict));

  return (
    <svg viewBox="10 60 480 180" className="w-full">
      <defs>
        <linearGradient id="islandFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e293b" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id="dotFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="70%" stopColor="#6366f1" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.2" />
        </radialGradient>
      </defs>
      <path
        d={ISLAND_PATH}
        fill="url(#islandFill)"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1.2}
      />
      {DISTRICT_KEYS.map((code) => {
        const count = byDistrict[code] ?? 0;
        const selected = district === code;
        const r = 6 + 22 * (count / max);
        const { x, y } = CITY[code];
        return (
          <g
            key={code}
            onClick={() => setDistrict(selected ? null : code)}
            className="cursor-pointer"
            style={{ opacity: district && !selected ? 0.35 : 1 }}
          >
            <circle
              cx={x}
              cy={y}
              r={r}
              fill="url(#dotFill)"
              stroke={selected ? '#f0abfc' : 'rgba(255,255,255,0.3)'}
              strokeWidth={selected ? 2 : 1}
            >
              <title>
                {DISTRICT_LABELS[code]} — {count} candidates · {DISTRICT_SEATS[code]} seats
              </title>
            </circle>
            <text
              x={x}
              y={y - r - 6}
              textAnchor="middle"
              className="pointer-events-none select-none"
              style={{
                fill: '#f1f5f9',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {DISTRICT_LABELS[code]}
            </text>
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              className="pointer-events-none select-none"
              style={{
                fill: '#ffffff',
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {count}
            </text>
          </g>
        );
      })}
      {district ? (
        <g onClick={() => setDistrict(null)} className="cursor-pointer">
          <rect
            x={10}
            y={60}
            width={110}
            height={22}
            rx={11}
            fill="rgba(15,23,42,0.85)"
            stroke="rgba(255,255,255,0.15)"
          />
          <text
            x={65}
            y={75}
            textAnchor="middle"
            style={{ fill: '#cbd5e1', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
          >
            Clear district filter
          </text>
        </g>
      ) : null}
    </svg>
  );
}

// Rectangle grid layout — size proportional to seats, positions requested by user:
// NIC centre, KYR above, LIM below, FAM right, PAF left, LAR bottom-right (under FAM, right of LIM).
const GRID_LAYOUT: Record<DistrictKey, { col: number; row: number; colSpan: number; rowSpan: number }> = {
  KYR: { col: 2, row: 1, colSpan: 2, rowSpan: 1 }, // top-centre
  PAF: { col: 1, row: 2, colSpan: 1, rowSpan: 1 }, // left of NIC
  NIC: { col: 2, row: 2, colSpan: 2, rowSpan: 1 }, // middle (largest)
  FAM: { col: 4, row: 2, colSpan: 1, rowSpan: 1 }, // right of NIC
  LIM: { col: 2, row: 3, colSpan: 2, rowSpan: 1 }, // below NIC
  LAR: { col: 4, row: 3, colSpan: 1, rowSpan: 1 }, // bottom-right (right of LIM, under FAM)
};

function GridView({ byDistrict }: { byDistrict: Record<string, number> }) {
  const { district, setDistrict } = useFilters();
  const max = Math.max(1, ...Object.values(DISTRICT_SEATS));

  const cells = useMemo(() => {
    return DISTRICT_KEYS.map((code) => {
      const pos = GRID_LAYOUT[code];
      const seats = DISTRICT_SEATS[code] ?? 0;
      const candidates = byDistrict[code] ?? 0;
      const heightRatio = 0.35 + 0.65 * (seats / max);
      return { code, pos, seats, candidates, heightRatio };
    });
  }, [byDistrict, max]);

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
          height: 280,
        }}
      >
        {cells.map(({ code, pos, seats, candidates, heightRatio }) => {
          const selected = district === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setDistrict(selected ? null : code)}
              style={{
                gridColumn: `${pos.col} / span ${pos.colSpan}`,
                gridRow: `${pos.row} / span ${pos.rowSpan}`,
                background: `linear-gradient(135deg, rgba(99,102,241,${0.18 + 0.5 * heightRatio}), rgba(244,63,94,${0.08 + 0.35 * heightRatio}))`,
                borderColor: selected ? 'rgba(240,171,252,0.9)' : 'rgba(255,255,255,0.12)',
                opacity: district && !selected ? 0.35 : 1,
              }}
              className="relative flex flex-col items-start justify-between overflow-hidden rounded-xl border p-3 text-left transition hover:-translate-y-0.5"
            >
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  {DISTRICT_LABELS[code]}
                </div>
                <div className="text-[10px] text-slate-400">{seats} seats</div>
              </div>
              <div className="self-end text-right">
                <div className="font-mono text-2xl font-bold text-white">{candidates}</div>
                <div className="text-[10px] text-slate-400">candidates</div>
              </div>
            </button>
          );
        })}
      </div>
      {district ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setDistrict(null)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 transition hover:border-white/20 hover:bg-white/10"
          >
            Clear district filter
          </button>
        </div>
      ) : null}
    </div>
  );
}
