import { useState } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { Copy, Check, ExternalLink } from 'lucide-react';
import type { Prediction } from '../data/predict-store';
import { shareUrl } from '../data/predict-store';
import { PARTY_ORDER, partyColour, partyLabel, NIVO_THEME } from '../lib/theme';
import { useT } from '../lib/i18n';
import { useUI } from '../lib/store';

interface Props {
  prediction: Prediction;
}

export function PredictionCard({ prediction }: Props) {
  const t = useT();
  const locale = useUI((s) => s.locale);
  const [copied, setCopied] = useState(false);

  // Build bar data from party percentages — only parties with > 0%
  const barData = PARTY_ORDER
    .filter((code) => (prediction.partyPcts[code] ?? 0) > 0)
    .map((code) => ({
      party: partyLabel(code, locale),
      pct: +(prediction.partyPcts[code] ?? 0).toFixed(1),
      color: partyColour(code),
    }));

  const url = shareUrl(prediction);
  const tweetText = encodeURIComponent(
    `🔮 My prediction for the Cyprus 2026 elections!\n\n${PARTY_ORDER
      .filter((c) => (prediction.partyPcts[c] ?? 0) > 0)
      .map((c) => `${partyLabel(c, locale)}: ${prediction.partyPcts[c]?.toFixed(1)}%`)
      .join('\n')}\n\nMake yours:`
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const ts = new Date(prediction.timestamp);
  const dateStr = ts.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-5">
      {/* ── The visual card (screenshot-friendly) ── */}
      <div className="predict-card confetti-enter">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">
              {t('predict_card_title')}
            </div>
            <h3 className="text-xl font-bold text-white">{prediction.name}</h3>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              {t('predict_card_subtitle')}
            </div>
            <div className="text-xs text-slate-400">{dateStr}</div>
          </div>
        </div>

        {/* Bar chart */}
        <div className="h-[280px] sm:h-[320px]">
          <ResponsiveBar
            data={barData}
            keys={['pct']}
            indexBy="party"
            layout="horizontal"
            margin={{ top: 0, right: 50, bottom: 30, left: 80 }}
            padding={0.35}
            colors={(d) => (d.data as Record<string, unknown>).color as string}
            borderRadius={4}
            enableGridX={true}
            enableGridY={false}
            axisLeft={{
              tickSize: 0,
              tickPadding: 8,
            }}
            axisBottom={{
              tickSize: 0,
              tickPadding: 6,
              format: (v) => `${v}%`,
            }}
            label={(d) => `${d.value}%`}
            labelSkipWidth={28}
            labelTextColor="#fff"
            theme={NIVO_THEME}
            animate={true}
            motionConfig="gentle"
          />
        </div>

        {/* Bonus predictions if any */}
        {(prediction.bonusParliamentParties != null || prediction.bonusTurnout != null) && (
          <div className="mt-3 flex flex-wrap gap-3 border-t border-white/10 pt-3">
            {prediction.bonusParliamentParties != null && (
              <span className="rounded-lg bg-white/[0.06] px-3 py-1 text-xs text-slate-300">
                🏛 Parties in parliament: <strong className="text-white">{prediction.bonusParliamentParties}</strong>
              </span>
            )}
            {prediction.bonusTurnout != null && (
              <span className="rounded-lg bg-white/[0.06] px-3 py-1 text-xs text-slate-300">
                🗳 Turnout: <strong className="text-white">{prediction.bonusTurnout}%</strong>
              </span>
            )}
          </div>
        )}

        {/* Over/Under picks */}
        {prediction.overUnders && prediction.overUnders.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {prediction.overUnders.map((ou, i) => (
              <span
                key={i}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-300"
              >
                {ou.label}{' '}
                <strong className={ou.pick === 'over' ? 'text-emerald-400' : 'text-rose-400'}>
                  {ou.pick === 'over' ? '↑ Over' : '↓ Under'} {ou.line}
                </strong>
              </span>
            ))}
          </div>
        )}

        {/* Watermark */}
        <div className="mt-4 text-center text-[10px] tracking-wider text-slate-600">
          {t('predict_card_watermark')}
        </div>
      </div>

      {/* ── Share buttons ── */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-slate-300">
          {t('predict_share_title')}
        </h4>
        <div className="flex flex-wrap gap-2">
          <a
            href={`https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="share-btn share-btn-x"
          >
            𝕏 {t('predict_share_x')}
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="share-btn share-btn-fb"
          >
            <span className="text-sm">f</span> {t('predict_share_fb')}
          </a>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="share-btn share-btn-li"
          >
            in {t('predict_share_li')}
          </a>
          <button onClick={handleCopy} className="share-btn share-btn-copy">
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                {t('predict_share_copied')}
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                {t('predict_share_copy')}
              </>
            )}
          </button>
        </div>
        {/* Permanent link */}
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <ExternalLink className="h-3.5 w-3.5 flex-none text-slate-500" />
          <span className="truncate text-xs text-slate-400">{url}</span>
        </div>
      </div>
    </div>
  );
}
