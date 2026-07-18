import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { ImagePlus, X } from 'lucide-react';

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
  const [selectedLesson, setSelectedLesson] = useState('');
  const [questions, setQuestions] = useState(Array(10).fill({ question: '', correct_answer: 'A', image: '' }));

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const res = await fetch('/api/youchem/lessons');
        if (res.ok) {
          const all = await res.json();
          setLessons(all);
          if (all.length > 0) setSelectedLesson(all[0].id);
        }
      } catch (err) { console.error(err); }
    };
    fetchLessons();
  }, []);

  const updateQuestion = (index: number, field: string, value: string) => {
    const qs = [...questions];
    qs[index] = { ...qs[index], [field]: value };
    setQuestions(qs);
  };

  const handleSaveQuiz = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedLesson) return alert('الرجاء اختيار حصة');
    try {
      const res = await fetch('/api/youchem/quizzes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: selectedLesson, questions }) });
      if (res.ok) { alert('تم حفظ الاختبار بنجاح'); setQuestions(Array(10).fill({ question: '', correct_answer: 'A', image: '' })); }
    } catch { alert('خطأ في حفظ الاختبار'); }
  };

  const handleImageChange = async (qIndex: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) return alert('الرجاء اختيار صورة PNG أو JPG');
    if (file.size > 5 * 1024 * 1024) return alert('حجم الصورة كبير جداً (الحد 5 ميجا)');
    try { updateQuestion(qIndex, 'image', await resizeImageToFixedDimensions(file)); }
    catch { alert('تعذر معالجة الصورة'); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">إدارة الاختبارات</h1>
        <p className="text-slate-500 text-sm mt-0.5">إنشاء اختبار من 10 أسئلة لكل درس</p>
      </div>

      <form onSubmit={handleSaveQuiz} className="neon-card p-6 rounded-2xl space-y-6">

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">اختر الحصة</label>
          <select value={selectedLesson} onChange={e => setSelectedLesson(e.target.value)} className="neon-input w-full px-4 py-2.5 rounded-xl text-sm" required>
            {lessons.map(l => <option key={l.id} value={l.id}>{l.title} ({l.platform})</option>)}
          </select>
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
          <button type="submit" className="neon-btn w-full px-6 py-3 rounded-xl font-bold">حفظ الاختبار</button>
        </div>
      </form>
    </div>
  );
}
