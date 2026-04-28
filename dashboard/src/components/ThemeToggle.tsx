import { Moon, Sun } from 'lucide-react';
import { useUI } from '../lib/store';

export function ThemeToggle() {
  const theme = useUI((s) => s.theme);
  const toggleTheme = useUI((s) => s.toggleTheme);
  const isLight = theme === 'light';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
