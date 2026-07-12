import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowLeft, ArrowRight } from 'lucide-react';

export function GradeSelection() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSelectGrade = async (grade: string) => {
    setLoading(true);
    try {
      // SERVER ACTION: Set grade
      const res = await fetch('/api/student/set-grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradeLevel: grade })
      });
      if (res.ok) {
        navigate('/student-dashboard');
      }
    } catch (err) {
      alert('حدث خطأ');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-200 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 relative">
            <img src="/logo.png" alt="YouChem Logo" className="w-full h-full object-contain rounded-full border-4 border-slate-50 shadow-sm" onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }} />
            <div className="w-full h-full bg-blue-100 rounded-full flex items-center justify-center hidden">
              <GraduationCap className="w-12 h-12 text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">            مرحباً بك في <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">YouChem</span> Platform          </h1>
          <p className="text-sm font-semibold text-slate-400 mb-2">by Mr.ahmed</p>
          <p className="text-slate-500">اختر الصف الدراسي الخاص بك للبدء</p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={() => handleSelectGrade('2nd_sec')}
            disabled={loading}
            className="w-full group flex items-center justify-between p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50"
          >
            <span className="font-bold text-lg text-slate-700 group-hover:text-blue-700">الصف الثاني الثانوي</span>
            <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-transform group-hover:-translate-x-1" />
          </button>
          
          <button 
            onClick={() => handleSelectGrade('3rd_sec')}
            disabled={loading}
            className="w-full group flex items-center justify-between p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50"
          >
            <span className="font-bold text-lg text-slate-700 group-hover:text-blue-700">الصف الثالث الثانوي</span>
            <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-transform group-hover:-translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
