import { ExternalLink, MessageSquarePlus, ShieldCheck, Clock3 } from 'lucide-react';
import { SectionHeader } from '../components/SectionHeader';
import type { Dataset } from '../data/types';

export function SubmitCorrection({ data }: { data: Dataset }) {
  const sheetUrl = data.meta.correction_sheet_url;

  return (
    <div>
      <SectionHeader
        eyebrow="Help improve the data"
        title="Spotted something wrong? Tell us."
        subtitle={
          <>
            This site pulls candidate information from many public sources. Some
            values may be wrong, outdated, or missing. You can suggest a fix in
            a shared Google Sheet — a human curator will review it and the
            correction will appear in the next update.
          </>
        }
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
            Open the correction sheet
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </a>
          <p className="mt-3 text-xs text-slate-400">
            The sheet opens in a new tab. You don't need an account to view it,
            but you'll need a free Google account to leave a comment.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-100">
          The correction sheet is not set up yet. Please check back soon.
        </div>
      )}

      <div className="mt-10">
        <h3 className="mb-4 text-lg font-semibold text-white">How to submit a correction</h3>
        <ol className="space-y-4">
          <Step
            num={1}
            title="Open the sheet"
            body="Click the button above. It opens a Google Sheet that lists every candidate in a table."
          />
          <Step
            num={2}
            title="Find the candidate and the value you want to fix"
            body={
              <>
                Each row is one candidate. Each column is one piece of
                information — name, party, age, profession, social-media links,
                and so on. Scroll or use Google Sheets' search
                (<kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">F</kbd> on
                Windows/Linux, <kbd className="kbd">⌘</kbd> + <kbd className="kbd">F</kbd> on
                Mac) to jump to the cell you care about.
              </>
            }
          />
          <Step
            num={3}
            title="Leave a comment on the cell"
            body={
              <>
                Right-click the cell and choose <em>“Comment”</em> (or press{' '}
                <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">Alt</kbd>{' '}
                + <kbd className="kbd">M</kbd>). Write what the correct value
                should be and, if you can, add a link or explanation. For
                example:
                <span className="mt-2 block rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 font-mono text-xs text-slate-200">
                  This should be “Ιωάννης Παπαδόπουλος” — see his party
                  profile: https://…
                </span>
              </>
            }
          />
          <Step
            num={4}
            title="That's it"
            body="A curator will review your comment, decide whether to apply it, and the change will be published in the next nightly update of this site."
          />
        </ol>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InfoCard
          icon={ShieldCheck}
          title="You can't break anything"
          body="The sheet is shared in read + comment mode. You can leave comments, but you can't change any cell values directly."
        />
        <InfoCard
          icon={MessageSquarePlus}
          title="A human reviews every comment"
          body="A curator reads each suggestion and decides whether it's correct. Spam, opinions, or unverifiable claims are ignored."
        />
        <InfoCard
          icon={Clock3}
          title="Updates go live overnight"
          body="Approved corrections are applied to the database at night. The dashboard refreshes from that database, so your fix should be visible the next day."
        />
      </div>

      <p className="mt-10 text-xs text-slate-500">
        This is a community effort. Please keep suggestions factual and — where
        possible — include a source (official party page, news article,
        Wikipedia, official MoI results).
      </p>
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
