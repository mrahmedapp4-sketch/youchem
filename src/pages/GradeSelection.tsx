import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowLeft } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

export function GradeSelection() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [error, setError] = useState('');

  const [phone, setPhone] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [school, setSchool] = useState('');
  const [gradeLevel, setGradeLevel] = useState('2nd_sec');

  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/student/check-auth');
        if (res.ok) {
          const data = await res.json();
          if (data.needsProfile) {
            setNeedsProfile(true);
          } else {
            navigate('/student-dashboard');
            return;
          }
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
          setNeedsProfile(true);
        } else {
          navigate('/student-dashboard');
        }
      } else {
        setError(data.error || 'فشل تسجيل الدخول بحساب جوجل');
      }
    } catch (err) {
      setError('حدث خطأ أثناء تسجيل الدخول بحساب جوجل');
    }
    setSigningIn(false);
  };

  const handleCompleteProfile = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSavingProfile(true);
    try {
      const res = await fetch('/api/student/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, guardianPhone, school, gradeLevel }),
      });
      if (res.ok) {
        navigate('/student-dashboard');
      } else {
        const data = await res.json();
        setError(data.error || 'حدث خطأ');
      }
    } catch (err) {
      setError('حدث خطأ');
    }
    setSavingProfile(false);
  };

  const Logo = () => (
    <div className="w-24 h-24 mx-auto mb-4 relative">
      <img
        src="/logo.png"
        alt="YouChem Logo"
        className="w-full h-full object-contain rounded-full neon-glow-ring border-2 border-cyan-400/40 bg-slate-900"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
        }}
      />
      <div className="w-full h-full bg-cyan-500/10 rounded-full flex items-center justify-center hidden">
        <GraduationCap className="w-12 h-12 text-cyan-400" />
      </div>
    </div>
  );

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        جاري التحقق...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
      <div className="neon-card p-8 rounded-3xl max-w-md w-full">
        <div className="text-center mb-8">
          <Logo />
          <h1 className="text-2xl font-bold text-white mb-2">
            مرحباً بك في{' '}
            <span className="neon-text font-extrabold">YouChem</span>{' '}
            Platform
          </h1>
          <p className="text-sm font-semibold text-slate-400 mb-2">by Mr.ahmed</p>
          <p className="text-slate-400">{needsProfile ? 'أكمل بياناتك للبدء' : 'سجل دخولك بحساب جوجل للبدء'}</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-lg mb-4 text-sm text-center">{error}</div>
        )}

        {!needsProfile ? (
          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="neon-btn w-full flex items-center justify-center gap-3 p-4 rounded-2xl disabled:opacity-50 font-bold"
          >
            <svg className="w-5 h-5" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.084 5.571l6.19 5.238C41.396 35.606 44 30.24 44 24c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
            {signingIn ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول بحساب جوجل'}
          </button>
        ) : (
          <form onSubmit={handleCompleteProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">رقم الهاتف</label>
              <input
                type="tel"
                required
                dir="ltr"
                className="neon-input w-full p-3 rounded-xl"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">رقم ولي الأمر</label>
              <input
                type="tel"
                required
                dir="ltr"
                className="neon-input w-full p-3 rounded-xl"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">المدرسة</label>
              <input
                type="text"
                required
                className="neon-input w-full p-3 rounded-xl"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">الصف الدراسي</label>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setGradeLevel('2nd_sec')}
                  className={`w-full group flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${gradeLevel === '2nd_sec' ? 'border-cyan-400 bg-cyan-400/10 neon-glow-ring' : 'border-slate-700 hover:border-cyan-500/50'}`}
                >
                  <span className="font-bold text-slate-200">الصف الثاني الثانوي</span>
                  <ArrowLeft className="w-5 h-5 text-slate-500" />
                </button>
                <button
                  type="button"
                  onClick={() => setGradeLevel('3rd_sec')}
                  className={`w-full group flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${gradeLevel === '3rd_sec' ? 'border-cyan-400 bg-cyan-400/10 neon-glow-ring' : 'border-slate-700 hover:border-cyan-500/50'}`}
                >
                  <span className="font-bold text-slate-200">الصف الثالث الثانوي</span>
                  <ArrowLeft className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="neon-btn w-full font-semibold py-3 rounded-xl disabled:opacity-50"
            >
              {savingProfile ? 'جاري الحفظ...' : 'دخول'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
