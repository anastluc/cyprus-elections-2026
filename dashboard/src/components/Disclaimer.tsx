import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Info } from 'lucide-react';
import { useUI } from '../lib/store';

export function Disclaimer() {
  const { disclaimerDismissed, dismissDisclaimer, reopenDisclaimer } = useUI();

  return (
    <AnimatePresence>
      {!disclaimerDismissed ? (
        <motion.div
          key="banner"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -30, opacity: 0 }}
          className="sticky top-0 z-40 border-b border-amber-400/30 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-indigo-500/15 backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-[1600px] items-start gap-3 px-4 py-2.5 sm:px-6">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-300" />
            <p className="flex-1 text-xs leading-relaxed text-slate-200 sm:text-sm">
              <span className="font-semibold text-amber-200">AI-assisted data.</span>{' '}
              Some values on this dashboard were collected and classified using automated
              scraping and large language models. They may contain inaccuracies. Every
              field shows its source — please verify before citing.
            </p>
            <button
              onClick={dismissDisclaimer}
              className="flex-none rounded-md p-1 text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss disclaimer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.button
          key="pill"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={reopenDisclaimer}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-200 backdrop-blur-md transition hover:bg-amber-500/20"
        >
          <Info className="h-3.5 w-3.5" />
          AI-assisted data
        </motion.button>
      )}
    </AnimatePresence>
  );
}
