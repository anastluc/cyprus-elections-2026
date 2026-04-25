import { partyColour, partyLabel, partyFullName } from '../lib/theme';
import { useUI } from '../lib/store';

export function PartyBadge({ code, size = 'md' }: { code: string; size?: 'sm' | 'md' }) {
  const locale = useUI((s) => s.locale);
  const bg = partyColour(code);
  const pad = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';
  return (
    <span className="group relative inline-flex">
      <span
        className={`inline-flex items-center rounded-md font-semibold tracking-wide ${pad}`}
        style={{
          background: `${bg}26`,
          border: `1px solid ${bg}55`,
          color: lightish(bg),
        }}
      >
        {partyLabel(code, locale)}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-slate-900/95 px-2.5 py-1.5 text-[11px] font-medium text-slate-100 opacity-0 shadow-lg transition group-hover:opacity-100"
      >
        {partyFullName(code, locale)}
      </span>
    </span>
  );
}

function lightish(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lighten = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.55));
  return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
}

export function PartyDot({ code, size = 8 }: { code: string; size?: number }) {
  return (
    <span
      className="inline-block rounded-full"
      style={{ width: size, height: size, background: partyColour(code) }}
    />
  );
}
