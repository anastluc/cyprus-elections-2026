import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useFilters, useUI } from '../lib/store';
import { DISTRICT_LABELS, DISTRICT_SEATS, districtLabel } from '../lib/theme';

type DistrictKey = 'NIC' | 'LIM' | 'FAM' | 'LAR' | 'PAF' | 'KYR';

const DISTRICT_KEYS: DistrictKey[] = ['NIC', 'LIM', 'LAR', 'FAM', 'PAF', 'KYR'];

// Gradient from deep indigo to vivid pink
const COLOUR_STOPS = [
  [30, 27, 75],    // deep indigo
  [67, 56, 202],   // indigo-600
  [139, 92, 246],  // violet-500
  [192, 132, 252], // purple-400
  [232, 121, 249], // fuchsia-400
  [244, 114, 182], // pink-400
] as const;

function interpolateColour(t: number): string {
  const n = COLOUR_STOPS.length - 1;
  const i = Math.min(Math.floor(t * n), n - 1);
  const f = t * n - i;
  const [r1, g1, b1] = COLOUR_STOPS[i];
  const [r2, g2, b2] = COLOUR_STOPS[i + 1];
  const r = Math.round(r1 + (r2 - r1) * f);
  const g = Math.round(g1 + (g2 - g1) * f);
  const b = Math.round(b1 + (b2 - b1) * f);
  return `rgb(${r},${g},${b})`;
}

// Seat grid layout
const GRID_LAYOUT: Record<DistrictKey, { col: number; row: number; colSpan: number; rowSpan: number }> = {
  KYR: { col: 2, row: 1, colSpan: 2, rowSpan: 1 },
  PAF: { col: 1, row: 2, colSpan: 1, rowSpan: 1 },
  NIC: { col: 2, row: 2, colSpan: 2, rowSpan: 1 },
  FAM: { col: 4, row: 2, colSpan: 1, rowSpan: 1 },
  LIM: { col: 2, row: 3, colSpan: 2, rowSpan: 1 },
  LAR: { col: 4, row: 3, colSpan: 1, rowSpan: 1 },
};

// Cache GeoJSON at module level so it survives re-mounts
let cachedGeoData: GeoJSON.FeatureCollection | null = null;
const geoPromise = fetch('/data/cyprus-districts.geojson')
  .then((r) => r.json())
  .then((data: GeoJSON.FeatureCollection) => {
    cachedGeoData = data;
    return data;
  });

export function CyprusMap({ byDistrict }: { byDistrict: Record<string, number> }) {
  const [view, setView] = useState<'geo' | 'grid'>('geo');
  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-1">
        <button type="button" onClick={() => setView('geo')} className={tabClass(view === 'geo')}>
          Geographic
        </button>
        <button type="button" onClick={() => setView('grid')} className={tabClass(view === 'grid')}>
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

/* ───────────────────────────── GeoView (vanilla Leaflet) ─────────── */

function GeoView({ byDistrict }: { byDistrict: Record<string, number> }) {
  const { district, setDistrict } = useFilters();
  const locale = useUI((s) => s.locale);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(cachedGeoData);

  const max = useMemo(
    () => Math.max(1, ...DISTRICT_KEYS.map((k) => byDistrict[k] ?? 0)),
    [byDistrict],
  );

  // Load GeoJSON if not cached yet
  useEffect(() => {
    if (geoData) return;
    geoPromise.then(setGeoData);
  }, [geoData]);

  // styleFor
  const styleFor = useCallback(
    (code: string) => {
      const count = byDistrict[code] ?? 0;
      const t = count / max;
      const isSelected = district === code;
      const isDimmed = !!district && !isSelected;

      return {
        fillColor: interpolateColour(t),
        fillOpacity: isDimmed ? 0.15 : 0.55 + 0.25 * t,
        color: isSelected ? '#f0abfc' : 'rgba(255,255,255,0.35)',
        weight: isSelected ? 3 : 1.5,
        opacity: isDimmed ? 0.3 : 1,
      };
    },
    [byDistrict, max, district],
  );

  // Init map + manage lifecycle
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !geoData) return;

    // Create map
    const map = L.map(el, {
      center: [35.1, 33.4],
      zoom: 9,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      minZoom: 8,
      maxZoom: 12,
      scrollWheelZoom: false,
      attributionControl: false,
    });
    mapRef.current = map;

    // Dark base tiles (CartoDB Voyager dark no-labels)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
    }).addTo(map);

    // Labels on top
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      pane: 'overlayPane',
    }).addTo(map);

    // Force size recalculation
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      geoLayerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoData]); // Only re-init when geoData first loads

  // Update/recreate GeoJSON overlay when data or selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geoData) return;

    if (geoLayerRef.current) {
      map.removeLayer(geoLayerRef.current);
    }

    const layer = L.geoJSON(geoData, {
      style: (feature) => {
        const code = feature?.properties?.code as string;
        return styleFor(code);
      },
      onEachFeature: (feature, featureLayer) => {
        const code = feature.properties?.code as string;
        const name = districtLabel(code, locale);
        const count = byDistrict[code] ?? 0;
        const seats = DISTRICT_SEATS[code] ?? 0;

        featureLayer.bindTooltip(
          `<div style="font-family:Inter,sans-serif;text-align:center;">
            <div style="font-weight:700;font-size:13px;color:#f1f5f9;">${name}</div>
            <div style="font-size:20px;font-weight:800;color:#fff;margin:2px 0;font-family:'JetBrains Mono',monospace;">${count}</div>
            <div style="font-size:11px;color:#94a3b8;">candidates · ${seats} seats</div>
          </div>`,
          { direction: 'top', className: 'cyprus-tooltip', offset: [0, -8] },
        );

        featureLayer.on({
          mouseover: (e) => {
            const l = e.target as L.Path;
            l.setStyle({ fillOpacity: 0.85, weight: 2.5, color: '#e2e8f0' });
            l.bringToFront();
          },
          mouseout: (e) => {
            const l = e.target as L.Path;
            l.setStyle(styleFor(code));
          },
          click: () => {
            setDistrict(district === code ? null : code);
          },
        });
      },
    }).addTo(map);

    geoLayerRef.current = layer;
  }, [geoData, byDistrict, district, locale, max, setDistrict, styleFor]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10">
      {/* Inject critical Leaflet CSS fixes for Tailwind v4 layer conflicts */}
      <style dangerouslySetInnerHTML={{ __html: LEAFLET_FIX_CSS }} />

      {/* Legend */}
      <div className="absolute right-3 top-3 z-[1000] rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 backdrop-blur-md">
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Candidates</div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400">0</span>
          <div
            className="h-2 w-20 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${interpolateColour(0)}, ${interpolateColour(0.5)}, ${interpolateColour(1)})`,
            }}
          />
          <span className="text-[10px] text-slate-400">{max}</span>
        </div>
      </div>

      {/* Clear filter */}
      {district && (
        <button
          type="button"
          onClick={() => setDistrict(null)}
          className="absolute left-3 top-3 z-[1000] rounded-full border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md transition hover:border-white/20 hover:bg-slate-800/90"
        >
          ✕ Clear filter
        </button>
      )}

      {/* Map container — always rendered, Leaflet attaches to this div */}
      <div
        ref={containerRef}
        style={{ height: 380, width: '100%', background: '#0c1222' }}
      />
    </div>
  );
}

// Critical Leaflet CSS that Tailwind v4 CSS layers can override
const LEAFLET_FIX_CSS = `
  .leaflet-container {
    position: relative !important;
    overflow: hidden !important;
    outline-offset: 1px;
    font-family: Inter, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }
  .leaflet-pane {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
  }
  .leaflet-tile-pane {
    z-index: 200 !important;
  }
  .leaflet-overlay-pane {
    z-index: 400 !important;
  }
  .leaflet-shadow-pane {
    z-index: 500 !important;
  }
  .leaflet-marker-pane {
    z-index: 600 !important;
  }
  .leaflet-tooltip-pane {
    z-index: 650 !important;
  }
  .leaflet-popup-pane {
    z-index: 700 !important;
  }
  .leaflet-map-pane {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    z-index: 0 !important;
  }
  .leaflet-tile,
  .leaflet-tile-container {
    position: absolute !important;
    left: 0;
    top: 0;
    pointer-events: none;
  }
  .leaflet-tile {
    border: none !important;
    visibility: visible !important;
    image-rendering: auto;
    filter: brightness(0.88) contrast(1.1);
  }
  .leaflet-zoom-animated {
    transform-origin: 0 0 !important;
  }
  .leaflet-zoom-anim .leaflet-zoom-animated {
    will-change: transform;
    transition: transform 0.25s cubic-bezier(0, 0, 0.25, 1) !important;
  }
  .leaflet-proxy {
    position: absolute !important;
  }
  .leaflet-control-container {
    position: absolute !important;
    z-index: 800 !important;
    pointer-events: none;
  }
  .leaflet-control-container > * {
    pointer-events: auto;
  }
  .leaflet-top, .leaflet-bottom {
    position: absolute !important;
    z-index: 1000 !important;
    pointer-events: none;
  }
  .leaflet-top {
    top: 0 !important;
  }
  .leaflet-right {
    right: 0 !important;
  }
  .leaflet-bottom {
    bottom: 0 !important;
  }
  .leaflet-left {
    left: 0 !important;
  }
  .leaflet-control {
    position: relative !important;
    pointer-events: auto !important;
    float: left;
    clear: both;
  }
  .leaflet-right .leaflet-control {
    float: right;
    clear: right;
  }
  .leaflet-control-zoom {
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 8px !important;
    overflow: hidden;
    margin: 10px !important;
  }
  .leaflet-control-zoom a {
    display: block !important;
    width: 28px !important;
    height: 28px !important;
    line-height: 28px !important;
    text-align: center !important;
    text-decoration: none !important;
    background: rgba(12, 18, 34, 0.9) !important;
    color: #cbd5e1 !important;
    border-bottom: 1px solid rgba(255,255,255,0.08) !important;
    font-size: 14px !important;
  }
  .leaflet-control-zoom a:hover {
    background: rgba(30, 41, 59, 0.95) !important;
    color: #f1f5f9 !important;
  }
  .leaflet-control-zoom-in {
    border-top-left-radius: 7px !important;
    border-top-right-radius: 7px !important;
  }
  .leaflet-control-zoom-out {
    border-bottom-left-radius: 7px !important;
    border-bottom-right-radius: 7px !important;
    border-bottom: none !important;
  }
  .cyprus-tooltip {
    background: rgba(11, 18, 36, 0.92) !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
    border-radius: 10px !important;
    padding: 8px 12px !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
    color: #e2e8f0 !important;
  }
  .leaflet-tooltip-top::before {
    border-top-color: rgba(11, 18, 36, 0.92) !important;
  }
`;

/* ───────────────────────────── GridView ───────────────────────────── */

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
