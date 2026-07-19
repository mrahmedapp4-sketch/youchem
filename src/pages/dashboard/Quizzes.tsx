import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { ImagePlus, X, Trash2, FileQuestion, ChevronDown, ChevronUp } from 'lucide-react';

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];
const IMAGE_WIDTH = 800;
const IMAGE_HEIGHT = 450;

const resizeImageToFixedDimensions = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = IMAGE_WIDTH; canvas.height = IMAGE_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
        const scale = Math.min(IMAGE_WIDTH / img.width, IMAGE_HEIGHT / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (IMAGE_WIDTH - w) / 2, (IMAGE_HEIGHT - h) / 2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('تعذر قراءة الصورة'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsDataURL(file);
  });
};

export function Quizzes() {
  const [lessons, setLessons] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [questions, setQuestions] = useState(Array(10).fill({ question: '', correct_answer: 'A', image: '' }));
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [lRes, qRes] = await Promise.all([
        fetch('/api/youchem/lessons'),
        fetch('/api/youchem/quizzes'),
      ]);
      if (lRes.ok) {
        const all = await lRes.json();
        setLessons(all);
        if (all.length > 0) setSelectedLesson(all[0].id);
      }
      if (qRes.ok) setQuizzes(await qRes.json());
    } catch (err) { console.error(err); }
  };

  const updateQuestion = (index: number, field: string, value: string) => {
    const qs = [...questions];
    qs[index] = { ...qs[index], [field]: value };
    setQuestions(qs);
  };

  const handleSaveQuiz = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedLesson) return alert('الرجاء اختيار حصة');
    try {
      const res = await fetch('/api/youchem/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: selectedLesson, questions }),
      });
      if (res.ok) {
        alert('تم حفظ الاختبار بنجاح');
        setQuestions(Array(10).fill({ question: '', correct_answer: 'A', image: '' }));
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'خطأ في حفظ الاختبار');
      }
    } catch { alert('خطأ في حفظ الاختبار'); }
  };

  const handleDeleteQuiz = async (quizId: string, lessonTitle: string) => {
    if (!confirm(`هل أنت متأكد من حذف اختبار "${lessonTitle}"؟`)) return;
    try {
      const res = await fetch(`/api/youchem/quizzes/${quizId}`, { method: 'DELETE' });
      if (res.ok) fetchData();
      else alert('حدث خطأ أثناء الحذف');
    } catch { alert('حدث خطأ'); }
  };

  const handleImageChange = async (qIndex: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) return alert('الرجاء اختيار صورة PNG أو JPG');
    if (file.size > 5 * 1024 * 1024) return alert('حجم الصورة كبير جداً (الحد 5 ميجا)');
    try { updateQuestion(qIndex, 'image', await resizeImageToFixedDimensions(file)); }
    catch { alert('تعذر معالجة الصورة'); }
  };

  // Map lessonId → title for display
  const lessonMap: Record<string, string> = {};
  lessons.forEach(l => { lessonMap[l.id] = l.title; });

  const selectedLessonHasQuiz = quizzes.some((q: any) => q.lessonId === selectedLesson);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">إدارة الاختبارات</h1>
        <p className="text-slate-500 text-sm mt-0.5">عرض الاختبارات الموجودة أو إنشاء اختبار جديد</p>
      </div>

      {/* ── Existing quizzes ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">الاختبارات الحالية</h2>
        {quizzes.length === 0 ? (
          <div className="neon-card p-8 rounded-2xl text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <FileQuestion className="w-8 h-8 text-slate-300" />
            لا توجد اختبارات بعد
          </div>
        ) : (
          <div className="space-y-2">
            {quizzes.map((quiz: any) => {
              const title = lessonMap[quiz.lessonId] || quiz.lessonId;
              const isExpanded = expandedQuiz === quiz.id;
              return (
                <div key={quiz.id} className="neon-card rounded-2xl overflow-hidden">
                  {/* Header row */}
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                      <FileQuestion className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{title}</p>
                      <p className="text-xs text-slate-400">{quiz.questions?.length || 0} سؤال</p>
                    </div>
                    <button
                      onClick={() => setExpandedQuiz(isExpanded ? null : quiz.id)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      title="عرض الأسئلة"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDeleteQuiz(quiz.id, title)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="حذف الاختبار"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Expanded questions */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 px-5 py-4 space-y-3">
                      {(quiz.questions || []).map((q: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-800">{q.question || '—'}</p>
                            {q.image && (
                              <img src={q.image} alt="" className="mt-2 max-h-24 rounded-lg border border-slate-200 object-contain" />
                            )}
                          </div>
                          <span className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                            {q.correct_answer}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create new quiz ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">إنشاء اختبار جديد</h2>
        <form onSubmit={handleSaveQuiz} className="neon-card p-6 rounded-2xl space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">اختر الحصة</label>
            <select value={selectedLesson} onChange={e => setSelectedLesson(e.target.value)} className="neon-input w-full px-4 py-2.5 rounded-xl text-sm" required>
              {lessons.map(l => <option key={l.id} value={l.id}>{l.title} ({l.platform})</option>)}
            </select>
            {selectedLessonHasQuiz && (
              <p className="mt-2 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                ⚠️ هذه الحصة عندها اختبار بالفعل — احذفه أولاً من القائمة بالأعلى لإنشاء اختبار جديد
              </p>
            )}
          </div>

          <div className="space-y-8">
            {questions.map((q, qIndex) => (
              <div key={qIndex} className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center shrink-0">{qIndex + 1}</span>
                  <h3 className="font-bold text-slate-800 text-sm">السؤال رقم {qIndex + 1}</h3>
                </div>

                <input
                  type="text" placeholder="نص السؤال..." required
                  value={q.question} onChange={e => updateQuestion(qIndex, 'question', e.target.value)}
                  className="neon-input w-full px-4 py-2.5 rounded-xl text-sm"
                />

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-600">صورة السؤال (اختياري)</label>
                  {q.image ? (
                    <div className="relative w-full max-w-md">
                      <div className="w-full aspect-video bg-white rounded-xl overflow-hidden border border-slate-200">
                        <img src={q.image} alt={`صورة ${qIndex + 1}`} className="w-full h-full object-contain" />
                      </div>
                      <button type="button" onClick={() => updateQuestion(qIndex, 'image', '')}
                        className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-sm">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full max-w-md aspect-video border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
                      <ImagePlus className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs text-slate-400">إضافة صورة PNG أو JPG</span>
                      <input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={e => handleImageChange(qIndex, e)} className="hidden" />
                    </label>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-600">الإجابة الصحيحة</label>
                  <div className="flex gap-2">
                    {ANSWER_LETTERS.map(letter => (
                      <button key={letter} type="button" onClick={() => updateQuestion(qIndex, 'correct_answer', letter)}
                        className={`w-12 h-12 rounded-xl font-bold border-2 transition-all text-sm ${
                          q.correct_answer === letter
                            ? 'bg-emerald-600 border-emerald-600 text-white neon-glow-ring'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                        }`}
                      >{letter}</button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <button type="submit" disabled={selectedLessonHasQuiz} className="neon-btn w-full px-6 py-3 rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed">حفظ الاختبار</button>
          </div>
        </form>
      </div>
    </div>
  );
}
