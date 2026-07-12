import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export function StudentLogin() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('2nd_sec');
  const [error, setError] = useState('');
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(needsRegistration ? { code, name, grade } : { code })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        navigate('/lessons');
      } else {
        if (data.error === 'يرجى إدخال الاسم والصف الدراسي في أول تسجيل') {
          setNeedsRegistration(true);
        } else {
          setError(data.error || 'فشل تسجيل الدخول');
        }
      }
    } catch (err) {
      setError('حدث خطأ بالاتصال');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-sm w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-slate-900">تسجيل دخول الطلاب</h1>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">كود الدخول (Scratch Card)</label>
            <input
              type="text"
              required
              className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={needsRegistration}
            />
          </div>

          {needsRegistration && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">الاسم الثلاثي</label>
                <input
                  type="text"
                  required
                  className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الصف الدراسي</label>
                <select
                  className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                >
                  <option value="2nd_sec">الصف الثاني الثانوي</option>
                  <option value="3rd_sec">الصف الثالث الثانوي</option>
                </select>
              </div>
            </>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {needsRegistration ? 'تسجيل جديد' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
