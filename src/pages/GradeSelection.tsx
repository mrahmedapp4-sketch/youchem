import { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ChevronLeft, Languages, Moon, Sun } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { tr } from '../lib/translations';

const PHONE_PATTERN = /^01\d{9}$/;

const getDeviceId = (): string => {
  const key = 'youchem_device_id';
  const existing = window.localStorage.getItem(key);
  if (existing && /^[A-Za-z0-9_-]{16,128}$/.test(existing)) return existing;
  const generated = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
  window.localStorage.setItem(key, generated);
  return generated;
};

const normalizeArabicDigits = (value: string): string =>
  value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));

type ProfileDraft = {
  name: string;
  phone: string;
  guardianPhone: string;
  school: string;
  gradeLevel: string;
};

const getProfileDraftKey = (email: string) =>
  `youchem_profile_draft_${encodeURIComponent(email.trim().toLowerCase())}`;

const readProfileDraft = (email: string): Partial<ProfileDraft> => {
  if (!email) return {};
  try {
    const saved = window.localStorage.getItem(getProfileDraftKey(email));
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export function GradeSelection() {
  const { lang, toggleLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [error, setError] = useState('');
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Google profile info shown in the profile-completion form
  const [googleName, setGoogleName] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googlePicture, setGooglePicture] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [school, setSchool] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');

  const navigate = useNavigate();

  const fillProfileFromUser = (user: any, googleFallbackName = '') => {
    const savedName = user?.name && user.name !== 'طالب' ? user.name : googleFallbackName;
    const draft = readProfileDraft(user?.email || '');
    setGoogleName(savedName);
    setGoogleEmail(user?.email || '');
    setGooglePicture(user?.picture || '');
    setName(draft.name ?? savedName);
    setPhone(draft.phone ?? user?.phone ?? '');
    setGuardianPhone(draft.guardianPhone ?? user?.guardianPhone ?? '');
    setSchool(draft.school ?? user?.school ?? '');
    setGradeLevel(draft.gradeLevel ?? user?.gradeLevel ?? '');
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/student/check-auth');
        if (res.ok) {
          const data = await res.json();
          if (data.needsProfile) {
            // Restore every saved value and leave only missing fields to fill.
            fillProfileFromUser(data.user);
            setNeedsProfile(true);
          } else {
            navigate('/student-dashboard');
            return;
          }
        } else {
          // Stale/invalid cookie — already cleared by server. Show login form
          // silently without an error message so the user isn't confused.
        }
      } catch (err) {
        console.error(err);
      }
      setCheckingAuth(false);
    };
    checkAuth();
  }, [navigate]);

  const currentDraft = (): ProfileDraft => ({
    name,
    phone,
    guardianPhone,
    school,
    gradeLevel,
  });

  const saveDraft = (draft: ProfileDraft, keepalive = false) => {
    if (!googleEmail) return;
    try {
      window.localStorage.setItem(
        getProfileDraftKey(googleEmail),
        JSON.stringify(draft),
      );
    } catch {
      // The server copy is still attempted if local storage is unavailable.
    }

    fetch('/api/student/profile-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
      keepalive,
    }).catch(() => {
      // The local copy allows the student to resume if the request is cut off.
    });
  };

  // Persist as the student types, so closing the tab never discards the form.
  useEffect(() => {
    if (!needsProfile || !googleEmail) return;
    const draft = currentDraft();
    try {
      window.localStorage.setItem(
        getProfileDraftKey(googleEmail),
        JSON.stringify(draft),
      );
    } catch {
      // Continue with the server save.
    }

    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    setSavingDraft(true);
    draftSaveTimer.current = setTimeout(() => {
      fetch('/api/student/profile-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
        .then((res) => {
          if (res.ok) setSavingDraft(false);
        })
        .catch(() => setSavingDraft(false));
  }, 700);

    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
  }, [needsProfile, googleEmail, name, phone, guardianPhone, school, gradeLevel]);

  // A final keepalive request covers the short window between the last keystroke
  // and the debounced save when the browser hides or closes the tab.
  useEffect(() => {
    if (!needsProfile || !googleEmail) return;
    const saveBeforeLeaving = () => saveDraft(currentDraft(), true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveBeforeLeaving();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', saveBeforeLeaving);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', saveBeforeLeaving);
    };
  }, [needsProfile, googleEmail, name, phone, guardianPhone, school, gradeLevel]);

  const handleGoogleSignIn = async () => {
    setError('');
    setSigningIn(true);
    try {
      const { idToken } = await signInWithGoogle();
      const res = await fetch('/api/student/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, deviceId: getDeviceId() }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.needsProfile) {
          // Pre-fill form with Google account info
          const gName = data.user?.name && data.user.name !== 'student' ? data.user.name : '';
          fillProfileFromUser({ ...data.user, picture: data.picture || data.user?.picture }, gName);
          setNeedsProfile(true);
        } else {
          navigate('/student-dashboard');
        }
      } else {
        if (
          data.error === 'DEVICE_LOCKED' ||
          data.error === 'DEVICE_BLOCKED' ||
          data.error === 'DEVICE_MISMATCH' ||
          data.error === 'SESSION_CONFLICT'
        ) {
          setError(tr('contactTeacher', lang));
        } else {
          setError(data.error || tr('errGoogleFail', lang));
        }
      }
    } catch (err) {
      console.error('Google sign-in failed:', err);
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('');
      } else if (code === 'auth/popup-blocked') {
        setError(lang === 'ar'
          ? 'المتصفح منع نافذة جوجل. اسمح بالنوافذ المنبثقة للموقع وحاول مرة أخرى.'
          : 'Your browser blocked the Google window. Allow pop-ups for this site and try again.');
      } else if (code === 'auth/network-request-failed') {
        setError(lang === 'ar'
          ? 'الاتصال بجوجل انقطع. اتأكد من الإنترنت وحاول تاني.'
          : 'The connection to Google was interrupted. Check your internet and try again.');
      } else {
        setError(code ? `${tr('errGoogleGeneric', lang)} (${code})` : tr('errGoogleGeneric', lang));
      }
    }
    setSigningIn(false);
  };

  const handleCompleteProfile = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedName = name.trim();
    const trimmedPhone = normalizeArabicDigits(phone.trim());
    const trimmedGuardianPhone = normalizeArabicDigits(guardianPhone.trim());
    const trimmedSchool = school.trim();

    const letterCount = Array.from(trimmedName).filter((character) => /\p{L}/u.test(String(character))).length;
    if (letterCount < 8 || trimmedName === 'طالب') {
      setError(tr('errNameShort', lang));
      return;
    }
    if (!PHONE_PATTERN.test(trimmedPhone)) {
      setError(tr('errPhone', lang));
      return;
    }
    if (!PHONE_PATTERN.test(trimmedGuardianPhone)) {
      setError(tr('errGuardian', lang));
      return;
    }
    if (!trimmedSchool) {
      setError(tr('errSchool', lang));
      return;
    }
    if (gradeLevel !== '2nd_sec' && gradeLevel !== '3rd_sec') {
      setError(tr('errGrade', lang));
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch('/api/student/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          phone: trimmedPhone,
          guardianPhone: trimmedGuardianPhone,
          school: trimmedSchool,
          gradeLevel,
        }),
      });
      if (res.ok) {
        try {
          window.localStorage.removeItem(getProfileDraftKey(googleEmail));
        } catch {}
        navigate('/student-dashboard');
      } else {
        const data = await res.json();
        setError(data.error || tr('errGeneric', lang));
      }
    } catch (err) {
      setError(tr('errGeneric', lang));
    }
    setSavingProfile(false);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        {tr('checkingAuth', lang)}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center gap-8 p-4 lg:px-16" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

      {/* Teacher image — desktop only, shown on login screen only, points toward the card.
          In RTL (Arabic) the flex container reverses order so this first-in-DOM div appears
          on the right side. In LTR (English) we push it to the end with order-last so it
          still appears on the right side — keeping the pointing finger aimed at the card. */}
      {!needsProfile && (
        <div
          className={`hidden lg:flex flex-col items-center justify-end self-stretch pointer-events-none select-none${lang === 'en' ? ' order-last' : ''}`}
          style={{ minWidth: 220 }}
        >
          <img
            src="/mr-ahmed.png"
            alt="مستر أحمد"
            className="h-[70vh] max-h-[560px] w-auto object-contain drop-shadow-xl"
          />
        </div>
      )}

      <div className="neon-card p-8 rounded-2xl max-w-md w-full">

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

        {/* Logo + heading */}
        <div className="text-center mb-8">
          <div className="w-full mx-auto mb-4">
            <img
              src="/logo.png"
              alt="يوكيم"
              className="w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center hidden mx-auto">
              <GraduationCap className="w-10 h-10 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            {tr('welcomeTo', lang)}{' '}
            <span className="neon-text">youchem platform</span>
          </h1>
          <p className="text-xs font-semibold text-slate-400 mb-1">{tr('byMrAhmed', lang)}</p>
          <p className="text-sm text-slate-500">
            {needsProfile ? tr('completeProfile', lang) : tr('loginSubtitle', lang)}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-sm text-center">
            {error}
          </div>
        )}

        {!needsProfile ? (
          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="neon-btn w-full flex items-center justify-center gap-3 p-4 rounded-xl disabled:opacity-50 font-bold text-base"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.084 5.571l6.19 5.238C41.396 35.606 44 30.24 44 24c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
            {signingIn ? tr('signingIn', lang) : tr('signInWithGoogle', lang)}
          </button>
        ) : (
          <form onSubmit={handleCompleteProfile} className="space-y-4">

            <div
              className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-bold text-center leading-relaxed"
              role="alert"
            >
              {tr('warningReal', lang)}
            </div>

            <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-xl p-3 text-sm text-center leading-relaxed">
              {tr('fillAll', lang)}
            </div>

            {/* Google account info banner */}
            {(googlePicture || googleEmail) && (
              <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                {googlePicture && (
                  <img
                    src={googlePicture}
                    alt={tr('googleProfilePic', lang)}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full border-2 border-indigo-200 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  {googleName && (
                    <p className="text-sm font-bold text-indigo-800 truncate">{googleName}</p>
                  )}
                  {googleEmail && (
                    <p className="text-xs text-indigo-500 truncate" dir="ltr">{googleEmail}</p>
                  )}
                </div>
              </div>
            )}

            {[
              { label: tr('labelName', lang), state: name, setter: setName, type: 'text', placeholder: tr('placeholderName', lang), dir: 'rtl', minLength: 8 },
              { label: tr('labelPhone', lang), state: phone, setter: setPhone, type: 'tel', placeholder: '01xxxxxxxxx', dir: 'ltr', inputMode: 'numeric', pattern: '01[0-9]{9}', maxLength: 11 },
              { label: tr('labelGuardian', lang), state: guardianPhone, setter: setGuardianPhone, type: 'tel', placeholder: '01xxxxxxxxx', dir: 'ltr', inputMode: 'numeric', pattern: '01[0-9]{9}', maxLength: 11 },
              { label: tr('labelSchool', lang), state: school, setter: setSchool, type: 'text', placeholder: tr('placeholderSchool', lang), dir: 'rtl' },
            ].map(({ label, state, setter, type, placeholder, dir, minLength, inputMode, pattern, maxLength }) => (
              <div key={label}>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">{label}</label>
                <input
                  type={type}
                  required
                  minLength={minLength}
                  maxLength={maxLength}
                  inputMode={inputMode as any}
                  pattern={pattern}
                  dir={dir as any}
                  className="neon-input w-full p-3 rounded-xl"
                  value={state}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                />
              </div>
            ))}

            <div>
              <label className="block text-sm font-semibold mb-1.5 text-slate-700">{tr('labelGrade', lang)}</label>
              <div
                className="grid grid-cols-2 gap-3"
                onKeyDown={(e) => {
                  const grades = ['2nd_sec', '3rd_sec'];
                  const cur = grades.indexOf(gradeLevel);
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    setGradeLevel(grades[Math.min(grades.length - 1, cur + 1)] ?? grades[0]);
                  }
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    setGradeLevel(grades[Math.max(0, cur - 1)] ?? grades[0]);
                  }
                }}
              >
                {[
                  { value: '2nd_sec', label: tr('grade2', lang) },
                  { value: '3rd_sec', label: tr('grade3', lang) },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGradeLevel(value)}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 font-bold transition-all text-sm ${
                      gradeLevel === value
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 neon-glow-ring'
                        : 'border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                    <ChevronLeft className="w-4 h-4 opacity-40" />
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="neon-btn w-full font-bold py-3 rounded-xl disabled:opacity-50 mt-2"
            >
              {savingProfile ? tr('savingProfile', lang) : tr('saveProfile', lang)}
            </button>
            <p className="text-center text-xs text-slate-400" aria-live="polite">
              {savingDraft ? tr('savingDraft', lang) : tr('draftSaved', lang)}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
