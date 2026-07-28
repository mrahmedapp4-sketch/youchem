import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

export function TeacherLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        navigate('/youchem');
      } else {
        setError('كلمة السر غلط');
      }
    } catch {
      setError('في مشكلة في الاتصال');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
      <div className="neon-card p-8 rounded-2xl w-full max-w-sm">

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

        <h1 className="text-xl font-bold text-center mb-1 text-slate-900">لوحة تحكم مستر أحمد 🔐</h1>
        <p className="text-sm text-center text-slate-500 mb-6">منصة يوكيم</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-slate-700 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              كلمة السر
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
          <button type="submit" className="neon-btn w-full font-bold py-3 rounded-xl">
            ادخل
          </button>
        </form>
      </div>
    </div>
  );
}
