import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ChevronLeft } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

const CONTACT_TEACHER_MSG =
  'يبدو في مشكلة، كلم مستر أحمد علشان نحلها';

const PHONE_PATTERN = /^01\d{9}$/;

export function GradeSelection() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [error, setError] = useState('');

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
    setGoogleName(savedName);
    setGoogleEmail(user?.email || '');
    setGooglePicture(user?.picture || '');
    setName(savedName);
    setPhone(user?.phone || '');
    setGuardianPhone(user?.guardianPhone || '');
    setSchool(user?.school || '');
    setGradeLevel(user?.gradeLevel || '');
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

  const handleGoogleSignIn = async () => {
    setError('');
    setSigningIn(true);
    try {
      const { idToken } = await signInWithGoogle();
      const res = await fetch('/api/student/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
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
        if (data.error === 'DEVICE_LOCKED' || data.error === 'SESSION_CONFLICT') {
          setError(CONTACT_TEACHER_MSG);
        } else {
          setError(data.error || 'فشل تسجيل الدخول بجوجل');
        }
      }
    } catch (err) {
      console.error('Google sign-in failed:', err);
      const code = (err as { code?: string })?.code;
      setError(
        code
          ? `في مشكلة في تسجيل الدخول بجوجل (${code})`
          : 'في مشكلة في تسجيل الدخول بجوجل',
      );
    }
    setSigningIn(false);
  };

  const handleCompleteProfile = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedGuardianPhone = guardianPhone.trim();
    const trimmedSchool = school.trim();

    if (Array.from(trimmedName).length <= 8) {
      setError('الاسم لازم يكون أكتر من 8 حروف');
      return;
    }
    if (!PHONE_PATTERN.test(trimmedPhone)) {
      setError('رقم الطالب لازم يبدأ بـ 01 ويكون 11 رقم');
      return;
    }
    if (!PHONE_PATTERN.test(trimmedGuardianPhone)) {
      setError('رقم ولي الأمر لازم يبدأ بـ 01 ويكون 11 رقم');
      return;
    }
    if (!trimmedSchool) {
      setError('اكتب اسم المدرسة');
      return;
    }
    if (gradeLevel !== '2nd_sec' && gradeLevel !== '3rd_sec') {
      setError('اختار الصف الدراسي');
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
        navigate('/student-dashboard');
      } else {
        const data = await res.json();
        setError(data.error || 'في مشكلة');
      }
    } catch (err) {
      setError('في مشكلة');
    }
    setSavingProfile(false);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        بيتحقق...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
      <div className="neon-card p-8 rounded-2xl max-w-md w-full">

        {/* Logo + heading */}
        <div className="text-center mb-8">
          <div className="w-full mx-auto mb-4">
            <img
              src="/logo.png"
              alt="YouChem Logo"
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
            أهلاً بيك في{' '}
            <span className="neon-text">YouChem</span>{' '}
            Platform
          </h1>
          <p className="text-xs font-semibold text-slate-400 mb-1">by Mr.ahmed</p>
          <p className="text-sm text-slate-500">
            {needsProfile ? 'خلّص بياناتك علشان تبدأ' : 'سجّل دخولك بجوجل علشان تبدأ'}
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
            {signingIn ? 'بيسجل دخولك...' : 'ادخل بحساب جوجل'}
          </button>
        ) : (
          <form onSubmit={handleCompleteProfile} className="space-y-4">

            {/* Google account info banner */}
            {(googlePicture || googleEmail) && (
              <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                {googlePicture && (
                  <img
                    src={googlePicture}
                    alt="صورة حساب جوجل"
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
              { label: 'اسمك بالكامل (أكثر من 8 حروف)', state: name, setter: setName, type: 'text', placeholder: 'اكتب اسمك بالكامل', dir: 'rtl', minLength: 9 },
              { label: 'رقم الطالب (11 رقم ويبدأ بـ 01)', state: phone, setter: setPhone, type: 'tel', placeholder: '01xxxxxxxxx', dir: 'ltr', inputMode: 'numeric', pattern: '01[0-9]{9}', maxLength: 11 },
              { label: 'رقم ولي الأمر (11 رقم ويبدأ بـ 01)', state: guardianPhone, setter: setGuardianPhone, type: 'tel', placeholder: '01xxxxxxxxx', dir: 'ltr', inputMode: 'numeric', pattern: '01[0-9]{9}', maxLength: 11 },
              { label: 'مدرستك', state: school, setter: setSchool, type: 'text', placeholder: '', dir: 'rtl' },
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
              <label className="block text-sm font-semibold mb-1.5 text-slate-700">انت في أنهي صف؟</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: '2nd_sec', label: 'تاني ثانوي' },
                  { value: '3rd_sec', label: 'تالت ثانوي' },
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
              {savingProfile ? 'بيتحفظ...' : 'يلا ادخل'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
