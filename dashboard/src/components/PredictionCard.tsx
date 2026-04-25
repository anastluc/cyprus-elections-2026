import { useRef, useState, useCallback } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { Copy, Check, ExternalLink, Download, Image } from 'lucide-react';
import html2canvas from 'html2canvas';
import type { Prediction } from '../data/predict-store';
import { getShareUrl } from '../data/predict-store';
import { PREDICT_PARTY_ORDER, partyColour, partyLabel, NIVO_THEME } from '../lib/theme';
import { useT } from '../lib/i18n';
import { useUI } from '../lib/store';

/* ── Election date ── */
const ELECTION_DATE = new Date('2026-05-24T00:00:00');
const HOSTING_URL = 'https://cyprus-elections-2026.web.app';

function daysBeforeElection(ts: string): number {
  const d = new Date(ts);
  return Math.max(0, Math.ceil((ELECTION_DATE.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

interface Props {
  prediction: Prediction;
}

export function PredictionCard({ prediction }: Props) {
  const t = useT();
  const locale = useUI((s) => s.locale);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Build bar data from party percentages — only parties with > 0%
  const barData = PREDICT_PARTY_ORDER
    .filter((code) => (prediction.partyPcts[code] ?? 0) > 0)
    .map((code) => ({
      party: partyLabel(code, locale),
      pct: +(prediction.partyPcts[code] ?? 0).toFixed(1),
      color: partyColour(code),
    }));

  const url = getShareUrl(prediction);

  const ts = new Date(prediction.timestamp);
  const days = daysBeforeElection(prediction.timestamp);
  const dateStr = ts.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = ts.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  /* ── Export card as PNG ── */
  const exportPNG = useCallback(async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    setExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#020617',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          setExporting(false);
          resolve(blob);
        }, 'image/png');
      });
    } catch (err) {
      console.error('Failed to export PNG:', err);
      setExporting(false);
      return null;
    }
  }, []);

  const handleDownloadPNG = useCallback(async () => {
    const blob = await exportPNG();
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `prediction-${prediction.name.replace(/\s+/g, '-').toLowerCase()}-${prediction.id}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [exportPNG, prediction]);

  /* ── Share with image (uses Web Share API or fallback) ── */
  const shareWithImage = useCallback(async (platform: 'twitter' | 'facebook' | 'linkedin') => {
    const blob = await exportPNG();

    // Compose text
    const text = `🔮 My prediction for the Cyprus 2026 elections!\n\n${PREDICT_PARTY_ORDER
      .filter((c) => (prediction.partyPcts[c] ?? 0) > 0)
      .map((c) => `${partyLabel(c, locale)}: ${prediction.partyPcts[c]?.toFixed(1)}%`)
      .join('\n')}\n\n${url}`;

    // Try Web Share API with file (mobile-friendly — attaches image directly)
    if (blob && navigator.share && navigator.canShare) {
      const file = new File([blob], 'prediction.png', { type: 'image/png' });
      const shareData = { text, files: [file] };
      if (navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          return;
        } catch { /* User cancelled or unsupported — fall through */ }
      }
    }

    // Desktop fallback: copy both the post text AND the PNG to the
    // clipboard in a single ClipboardItem. Facebook and LinkedIn ignore
    // any prefilled text from intent URLs, so the user pastes (Cmd/Ctrl+V)
    // into the composer — text goes into the body, image attaches.
    // If clipboard access is unavailable (Safari, older browsers),
    // fall back to a PNG download.
    let didCopyImage = false;
    if (blob && navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
      try {
        const textBlob = new Blob([text], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
            'text/plain': textBlob,
          }),
        ]);
        didCopyImage = true;
        setImageCopied(true);
        setTimeout(() => setImageCopied(false), 5000);
      } catch {
        // Permission denied or unsupported — fall back to download.
      }
    }

    if (!didCopyImage && blob) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `prediction-${prediction.id}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }

    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(text);

    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    };

    window.open(urls[platform], '_blank', 'noopener,noreferrer');
  }, [exportPNG, prediction, locale, url]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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

  return (
    <div className="space-y-5">
      {/* ── The visual card (PNG-exportable) ── */}
      <div ref={cardRef} className="predict-card confetti-enter" style={{ minWidth: 480 }}>
        {/* Header with prominent timestamp */}
        <div className="mb-1 flex items-center justify-between">
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
          </div>
        </div>

        {/* Prominent timestamp banner */}
        <div className="mb-4 flex items-center justify-between rounded-lg bg-white/[0.06] px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-white">{dateStr}</div>
            <div className="text-sm text-slate-400">{timeStr}</div>
          </div>
          <div className="rounded-full bg-gradient-to-r from-purple-600/30 to-fuchsia-600/30 px-3 py-0.5 text-xs font-bold text-purple-300">
            {days} days before elections
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
            axisLeft={{ tickSize: 0, tickPadding: 8 }}
            axisBottom={{ tickSize: 0, tickPadding: 6, format: (v) => `${v}%` }}
            label={(d) => `${d.value}%`}
            labelSkipWidth={28}
            labelTextColor="#fff"
            theme={NIVO_THEME}
            animate={true}
            motionConfig="gentle"
          />
        </div>

        {/* Bonus predictions if any */}
        {prediction.bonusTurnout != null && (
          <div className="mt-3 flex flex-wrap gap-3 border-t border-white/10 pt-3">
            <span className="rounded-lg bg-white/[0.06] px-3 py-1 text-xs text-slate-300">
              🗳 Turnout: <strong className="text-white">{prediction.bonusTurnout}%</strong>
            </span>
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

        {/* Footer with hosting URL */}
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
          <div className="text-[11px] font-medium tracking-wider text-slate-500">
            {HOSTING_URL}
          </div>
          <div className="text-[10px] tracking-wider text-slate-600">
            🔮 {t('predict_card_watermark')}
          </div>
        </div>
      </div>

      {/* ── Share buttons ── */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-slate-300">
          {t('predict_share_title')}
        </h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => shareWithImage('twitter')}
            disabled={exporting}
            className="share-btn share-btn-x"
          >
            𝕏 {t('predict_share_x')}
          </button>
          <button
            onClick={() => shareWithImage('facebook')}
            disabled={exporting}
            className="share-btn share-btn-fb"
          >
            <span className="text-sm">f</span> {t('predict_share_fb')}
          </button>
          <button
            onClick={() => shareWithImage('linkedin')}
            disabled={exporting}
            className="share-btn share-btn-li"
          >
            in {t('predict_share_li')}
          </button>
          <button onClick={handleDownloadPNG} disabled={exporting} className="share-btn share-btn-copy">
            <Download className="h-3.5 w-3.5" />
            {exporting ? '…' : 'PNG'}
          </button>
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
        {/* Image-on-clipboard toast (shown briefly after a desktop share click) */}
        {imageCopied && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            <Image className="mt-0.5 h-3.5 w-3.5 flex-none" />
            <span>
              {t('predict_share_image_copied')}
            </span>
          </div>
        )}

        {/* Permanent link */}
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <ExternalLink className="h-3.5 w-3.5 flex-none text-slate-500" />
          <span className="truncate text-xs text-slate-400">{url}</span>
        </div>
      </div>
    </div>
  );
}
