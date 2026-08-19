import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Languages, LoaderCircle, Moon, Sun } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { tr } from '../lib/translations';
import { useTheme } from '../context/ThemeContext';

export function TeacherLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const navigate = useNavigate();
  const { lang, toggleLang } = useLang();
  const { theme, toggleTheme } = useTheme();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (loggingIn) return;
    setError('');
    setLoggingIn(true);
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      const res = await fetch('/api/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      if (res.ok) {
        navigate('/youchem');
      } else {
        setError(tr('errWrongPass', lang));
      }
    } catch (err) {
      setError((err as DOMException)?.name === 'AbortError'
        ? (lang === 'ar' ? 'الطلب أخد وقت طويل، حاول تاني.' : 'The request took too long. Please try again.')
        : tr('errConnection', lang));
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="neon-card p-8 rounded-2xl w-full max-w-sm">

        {/* Lang toggle */}
        <div className="flex justify-end mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
              aria-label={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
              className="theme-toggle"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors border border-slate-200 rounded-lg px-2.5 py-1.5"
            >
              <Languages className="w-3.5 h-3.5" />
              {lang === 'ar' ? 'EN' : 'عربي'}
            </button>
          </div>
        </div>

        {/* Logo */}
        <div className="mx-auto mb-6 flex items-center justify-center">
          <img
            src="/logo.png"
            alt="يوكيم"
            className="h-20 w-auto object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="h-20 w-48 bg-indigo-50 rounded-xl hidden" />
        </div>

        <h1 className="text-xl font-bold text-center mb-1 text-slate-900">{tr('teacherDashboard', lang)}</h1>
        <p className="text-sm text-center text-slate-500 mb-6">{tr('platformName', lang)}</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-slate-700 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              {tr('passwordLabel', lang)}
            </label>
            <input
              type="password"
              required
              className="neon-input w-full p-3 rounded-xl"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loggingIn} className="neon-btn w-full font-bold py-3 rounded-xl disabled:opacity-60">
            {loggingIn ? <LoaderCircle className="w-4 h-4 animate-spin mx-auto" /> : tr('loginBtn', lang)}
          </button>
        </form>
      </div>
    </div>
  );
}
