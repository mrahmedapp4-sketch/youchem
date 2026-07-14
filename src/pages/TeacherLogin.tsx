import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function TeacherLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // If we already have the cookie, we should theoretically redirect, 
  // but for a React app without SSR we just let the protected layout handle the check,
  // or attempt a quick ping. For now, we rely on the manual login form.

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch('/api/teacher/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      if (res.ok) {
        navigate('/youchem');
      } else {
        setError('كلمة المرور غير صحيحة');
      }
    } catch (err) {
      setError('حدث خطأ بالاتصال');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="neon-card p-8 rounded-2xl w-full max-w-sm">
        <div className="w-16 h-16 mx-auto mb-4">
          <img src="/logo.png" alt="YouChem Logo" className="w-full h-full object-contain rounded-full neon-glow-ring border-2 border-cyan-400/40 bg-slate-900" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-6 text-white">لوحة تحكم مستر أحمد</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">كلمة المرور</label>
            <input
              type="password"
              required
              className="neon-input w-full p-3 rounded-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="neon-btn w-full font-semibold py-3 rounded-lg"
          >
            دخول
          </button>
        </form>
      </div>
    </div>
  );
}
