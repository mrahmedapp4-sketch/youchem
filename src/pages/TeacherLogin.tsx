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
      <div className="bg-white p-8 rounded-xl shadow-sm w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6 text-slate-900">لوحة تحكم المدرس</h1>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">كلمة المرور</label>
            <input
              type="password"
              required
              className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            دخول
          </button>
        </form>
      </div>
    </div>
  );
}
