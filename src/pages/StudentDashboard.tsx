import { useState, useEffect } from 'react';
import { Video, CheckCircle, Lock, PlayCircle, FileText, Download, ClipboardList } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

type Section = 'lessons' | 'homework';

export function StudentDashboard() {
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('lessons');
  const [lessons, setLessons] = useState<any[]>([]);
  const [accesses, setAccesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [homeworksLoading, setHomeworksLoading] = useState(true);

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

  useEffect(() => {
    const fetchHomeworks = async () => {
      try {
        const res = await fetch('/api/student/homeworks');
        if (res.ok) {
          setHomeworks(await res.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setHomeworksLoading(false);
      }
    };
    fetchHomeworks();
  }, []);

  return (
    <div className="min-h-screen" dir="rtl">
      {/* Header */}
      <header className="neon-panel border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="YouChem Logo" className="w-10 h-10 object-contain rounded-full border-2 border-cyan-400/30" onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }} />
            <div className="w-10 h-10 bg-cyan-500/10 rounded-full flex items-center justify-center text-cyan-400 font-bold text-xl hidden">
              YC
            </div>
            <h1 className="font-bold text-xl tracking-tight text-white">              <span className="neon-text font-extrabold">YouChem</span> Platform            </h1>
          </div>
          
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">مرحباً بك 👋</h2>
          <p className="text-slate-400 mt-2">استكمل رحلة التعلم الخاصة بك.</p>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-3 mb-8 border-b border-cyan-500/10 pb-1">
          <button
            onClick={() => setSection('lessons')}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-bold transition-colors ${
              section === 'lessons'
                ? 'text-cyan-300 border-b-2 border-cyan-400 bg-cyan-400/5'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-5 h-5" />
            الحصص
          </button>
          <button
            onClick={() => setSection('homework')}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-bold transition-colors ${
              section === 'homework'
                ? 'text-cyan-300 border-b-2 border-cyan-400 bg-cyan-400/5'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            واجباتي
          </button>
        </div>

        {section === 'lessons' && (loading ? (
          <div className="text-center p-8 text-slate-400">جاري التحميل...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lessons.map((lesson) => {
              const access = accesses.find(a => a.lessonId === lesson.id);
              const isUnlocked = access?.quizPassed || access?.quizExempt;

              return (
                <Link to={`/lessons/${lesson.id}`} key={lesson.id} className="block group">
                  <div className="neon-card rounded-2xl overflow-hidden hover:border-cyan-400/50 transition-all h-full flex flex-col">
                    <div className="relative aspect-video bg-black/30">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="w-12 h-12 text-slate-600 group-hover:text-cyan-400 group-hover:scale-110 transition-all duration-300" />
                      </div>
                      {!isUnlocked && (
                        <div className="absolute top-4 left-4 p-2 bg-black/60 backdrop-blur-sm rounded-lg border border-white/10">
                          <Lock className="w-4 h-4 text-slate-300" />
                        </div>
                      )}
                      {isUnlocked && (
                        <div className="absolute top-4 left-4 p-2 bg-emerald-500/90 rounded-lg shadow-[0_0_12px_rgba(16,185,129,0.6)]">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-cyan-300 border border-cyan-400/20">
                        {lesson.platform}
                      </div>
                    </div>
                    
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-bold text-lg text-white group-hover:text-cyan-300 transition-colors mb-2">
                        {lesson.title}
                      </h3>
                      
                      <div className="mt-auto pt-4 flex items-center justify-between">
                        <span className={`text-sm font-semibold ${isUnlocked ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {isUnlocked ? 'تم فتح الحصة' : 'مغلق - يتطلب كود'}
                        </span>
                        
                        <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-cyan-400/10 flex items-center justify-center transition-colors">
                          <PlayCircle className={`w-4 h-4 ${isUnlocked ? 'text-cyan-400' : 'text-slate-500'}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            
            {lessons.length === 0 && (
              <div className="col-span-full p-8 text-center text-slate-400 neon-card rounded-2xl">
                لا توجد حصص متاحة في هذا الصف الدراسي حالياً.
              </div>
            )}
          </div>
        ))}

        {section === 'homework' && (homeworksLoading ? (
          <div className="text-center p-8 text-slate-400">جاري التحميل...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {homeworks.map((hw) => (
              <div key={hw.homeworkId} className="neon-card rounded-2xl overflow-hidden h-full flex flex-col p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-400/10 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6 text-cyan-300" />
                  </div>
                  <h3 className="font-bold text-lg text-white">{hw.lessonTitle}</h3>
                </div>

                <a
                  href={hw.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200 font-semibold text-sm mb-4"
                >
                  <Download className="w-4 h-4" />
                  تحميل ملف الواجب
                </a>

                <div className="mt-auto pt-4 flex items-center justify-between">
                  {hw.submission ? (
                    <span className="text-sm font-bold text-emerald-400">
                      تم التصحيح: {hw.submission.score} / {hw.submission.total}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-slate-500">لم تتم الإجابة بعد</span>
                  )}
                  <Link
                    to={`/lessons/${hw.lessonId}`}
                    className="neon-btn px-4 py-2 rounded-lg text-sm font-bold"
                  >
                    {hw.submission ? 'عرض الواجب' : 'حل الواجب'}
                  </Link>
                </div>
              </div>
            ))}

            {homeworks.length === 0 && (
              <div className="col-span-full p-8 text-center text-slate-400 neon-card rounded-2xl">
                لا توجد واجبات متاحة حالياً.
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
