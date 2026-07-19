import { useState, useEffect } from 'react';
import { Video, CheckCircle, Lock, PlayCircle, FileText, ClipboardList } from 'lucide-react';
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
        if (res.ok) setHomeworks(await res.json());
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

      {/* ── Top bar ── */}
      <header className="neon-panel border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img
              src="/logo.png"
              alt="YouChem"
              className="h-12 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="w-9 h-9 bg-indigo-50 rounded-full hidden" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">مرحباً بك 👋</h2>
          <p className="text-slate-500 mt-1">استكمل رحلة التعلم الخاصة بك.</p>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-8 border-b border-slate-200 pb-px">
          {([
            { id: 'lessons', label: 'الحصص', Icon: Video },
            { id: 'homework', label: 'واجباتي', Icon: ClipboardList },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex items-center gap-2 px-5 py-3 font-bold text-sm transition-colors border-b-2 -mb-px ${
                section === id
                  ? 'text-indigo-700 border-indigo-600'
                  : 'text-slate-500 border-transparent hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Lessons Grid ── */}
        {section === 'lessons' && (loading ? (
          <div className="text-center p-12 text-slate-400">جاري التحميل...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {lessons.map((lesson) => {
              const access = accesses.find(a => a.lessonId === lesson.id);
              const isUnlocked = !!access;

              return (
                <Link to={`/lessons/${lesson.id}`} key={lesson.id} className="block group">
                  <div className={`neon-card rounded-2xl overflow-hidden h-full flex flex-col transition-shadow hover:shadow-md ${isUnlocked ? '' : ''}`}>

                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-slate-100">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="w-10 h-10 text-slate-300 group-hover:text-indigo-400 transition-colors duration-300" />
                      </div>
                      {/* Lock / check badge */}
                      <div className={`absolute top-3 right-3 p-1.5 rounded-lg shadow-sm ${isUnlocked ? 'bg-emerald-500' : 'bg-white border border-slate-200'}`}>
                        {isUnlocked
                          ? <CheckCircle className="w-4 h-4 text-white" />
                          : <Lock className="w-4 h-4 text-slate-400" />
                        }
                      </div>
                      {/* Platform pill */}
                      <div className="absolute bottom-3 left-3 bg-indigo-600 text-white px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide">
                        {lesson.platform}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors mb-3 leading-snug">
                        {lesson.title}
                      </h3>
                      <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-100">
                        <span className={`text-xs font-semibold ${isUnlocked ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {isUnlocked ? '✓ تم فتح الحصة' : 'مغلق — يتطلب كود'}
                        </span>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isUnlocked ? 'bg-indigo-50' : 'bg-slate-100'}`}>
                          <PlayCircle className={`w-4 h-4 ${isUnlocked ? 'text-indigo-600' : 'text-slate-400'}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {lessons.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-400 neon-card rounded-2xl">
                لا توجد حصص متاحة في هذا الصف الدراسي حالياً.
              </div>
            )}
          </div>
        ))}

        {/* ── Homework Grid ── */}
        {section === 'homework' && (homeworksLoading ? (
          <div className="text-center p-12 text-slate-400">جاري التحميل...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {homeworks.map((hw) => (
              <div key={hw.id} className="neon-card rounded-2xl p-5 h-full flex flex-col">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="font-bold text-slate-900 leading-snug pt-1">{hw.title}</h3>
                </div>

                <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-100">
                  {hw.submission ? (
                    <span className="text-sm font-bold text-emerald-600">
                      ✓ التصحيح: {hw.submission.score} / {hw.submission.total}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">لم تتم الإجابة بعد</span>
                  )}
                  <Link
                    to={`/homework/${hw.id}`}
                    className="neon-btn px-4 py-2 rounded-lg text-sm font-bold"
                  >
                    {hw.submission ? 'عرض' : 'حل الواجب'}
                  </Link>
                </div>
              </div>
            ))}

            {homeworks.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-400 neon-card rounded-2xl">
                لا توجد واجبات متاحة حالياً.
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
