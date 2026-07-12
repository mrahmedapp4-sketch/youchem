import { useState, useEffect } from 'react';
import { Video, CheckCircle, Lock, LogOut, PlayCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

export function StudentDashboard() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<any[]>([]);
  const [accesses, setAccesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const res = await fetch('/api/student/lessons');
        if (res.ok) {
          const data = await res.json();
          setLessons(data.lessons);
          setAccesses(data.accesses);
        } else {
          // Navigate to grade selection if not set
          navigate('/');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLessons();
  }, [navigate]);

  const handleLogout = () => {
    navigate('/student-login');
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="YouChem Logo" className="w-10 h-10 object-contain rounded-full border-2 border-slate-100" onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }} />
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-inner hidden">
              YC
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-900">              <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">YouChem</span> Platform            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={handleLogout} className="p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600 rounded-lg transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">مرحباً بك 👋</h2>
          <p className="text-slate-500 mt-2">استكمل رحلة التعلم الخاصة بك.</p>
        </div>

        {loading ? (
          <div className="text-center p-8 text-slate-500">جاري التحميل...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessons.map((lesson) => {
              const access = accesses.find(a => a.lessonId === lesson.id);
              const isUnlocked = lesson.isFree || access?.quizPassed || access?.quizExempt;

              return (
                <Link to={`/lessons/${lesson.id}`} key={lesson.id} className="block group">
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all h-full flex flex-col">
                    <div className="relative aspect-video bg-slate-100">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="w-12 h-12 text-slate-300 group-hover:scale-110 transition-transform duration-300" />
                      </div>
                      {!isUnlocked && (
                        <div className="absolute top-4 left-4 p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm">
                          <Lock className="w-4 h-4 text-slate-700" />
                        </div>
                      )}
                      {isUnlocked && (
                        <div className="absolute top-4 left-4 p-2 bg-emerald-500 rounded-lg shadow-sm">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-slate-700">
                        {lesson.platform}
                      </div>
                    </div>
                    
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition-colors mb-2">
                        {lesson.title}
                      </h3>
                      
                      <div className="mt-auto pt-4 flex items-center justify-between">
                        <span className={`text-sm font-semibold ${isUnlocked ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {lesson.isFree ? 'متاح مجاناً' : isUnlocked ? 'تم فتح الحصة' : 'مغلق - يتطلب كود'}
                        </span>
                        
                        <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
                          <PlayCircle className={`w-4 h-4 ${isUnlocked ? 'text-blue-600' : 'text-slate-400'}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            
            {lessons.length === 0 && (
              <div className="col-span-full p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
                لا توجد حصص متاحة في هذا الصف الدراسي حالياً.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
