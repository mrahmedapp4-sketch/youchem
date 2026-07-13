import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { FileText, Trash2, UploadCloud } from 'lucide-react';

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

export function Homework() {
  const [lessons, setLessons] = useState<any[]>([]);
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numQuestions, setNumQuestions] = useState(10);
  const [answerKey, setAnswerKey] = useState<string[]>(Array(10).fill('A'));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLessons();
    fetchHomeworks();
  }, []);

  const fetchLessons = async () => {
    try {
      const res = await fetch('/api/youchem/lessons');
      if (res.ok) {
        const allLessons = await res.json();
        setLessons(allLessons);
        if (allLessons.length > 0) setSelectedLesson(allLessons[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHomeworks = async () => {
    try {
      const res = await fetch('/api/youchem/homeworks');
      if (res.ok) setHomeworks(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleNumQuestionsChange = (value: number) => {
    const n = Math.max(1, Math.min(100, value || 1));
    setNumQuestions(n);
    setAnswerKey((prev) => {
      const next = [...prev];
      if (n > next.length) {
        while (next.length < n) next.push('A');
      } else {
        next.length = n;
      }
      return next;
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('الرجاء اختيار ملف بصيغة PDF فقط');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      alert('حجم الملف كبير جداً، الرجاء اختيار ملف أصغر من 25 ميجابايت');
      return;
    }
    setPdfFile(file);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedLesson) return alert('الرجاء اختيار حصة');
    if (!pdfFile) return alert('الرجاء اختيار ملف PDF للواجب');

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('lessonId', selectedLesson);
      formData.append('numQuestions', String(numQuestions));
      formData.append('answerKey', JSON.stringify(answerKey));
      formData.append('pdf', pdfFile);

      const res = await fetch('/api/youchem/homework', { method: 'POST', body: formData });
      if (res.ok) {
        alert('تم حفظ الواجب بنجاح');
        setPdfFile(null);
        fetchHomeworks();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'حدث خطأ أثناء حفظ الواجب');
      }
    } catch (err) {
      alert('حدث خطأ أثناء حفظ الواجب');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الواجب؟')) return;
    try {
      const res = await fetch(`/api/youchem/homework/${id}`, { method: 'DELETE' });
      if (res.ok) fetchHomeworks();
    } catch (err) {
      alert('فشل في الحذف');
    }
  };

  const lessonTitle = (lessonId: string) => lessons.find((l) => l.id === lessonId)?.title || 'حصة محذوفة';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">إدارة الواجبات (Homework)</h1>
        <p className="text-slate-400 mt-1">
          ارفع ملف PDF للواجب، وحدد عدد الأسئلة والإجابة الصحيحة لكل سؤال (نظام بابل شيت)
        </p>
      </div>

      <form onSubmit={handleSave} className="neon-card p-8 rounded-2xl space-y-8">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">اختر الحصة</label>
          <select
            value={selectedLesson}
            onChange={(e) => setSelectedLesson(e.target.value)}
            className="neon-input w-full px-4 py-2 rounded-xl"
            required
          >
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title} ({l.platform})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">ملف الواجب (PDF)</label>
          {pdfFile ? (
            <div className="flex items-center justify-between gap-3 p-4 bg-black/20 rounded-xl border border-cyan-500/10">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-6 h-6 text-cyan-300 shrink-0" />
                <span className="text-slate-200 truncate">{pdfFile.name}</span>
              </div>
              <button type="button" onClick={() => setPdfFile(null)} className="text-red-400 hover:text-red-300 text-sm font-semibold shrink-0">
                إزالة
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full py-10 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-cyan-400/60 hover:bg-cyan-400/5 transition-colors">
              <UploadCloud className="w-8 h-8 text-slate-500 mb-2" />
              <span className="text-sm text-slate-400">اضغط لرفع ملف PDF</span>
              <input type="file" accept="application/pdf,.pdf" onChange={handleFileChange} className="hidden" />
            </label>
          )}
        </div>

        <div className="max-w-xs">
          <label className="block text-sm font-semibold text-slate-300 mb-2">عدد الأسئلة</label>
          <input
            type="number"
            min={1}
            max={100}
            value={numQuestions}
            onChange={(e) => handleNumQuestionsChange(parseInt(e.target.value, 10))}
            className="neon-input w-full px-4 py-2 rounded-xl"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-300">نموذج الإجابة الصحيحة</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {answerKey.map((ans, idx) => (
              <div key={idx} className="p-3 bg-black/20 rounded-xl border border-cyan-500/10 space-y-2">
                <span className="text-xs font-bold text-slate-400">سؤال {idx + 1}</span>
                <div className="flex gap-1">
                  {ANSWER_LETTERS.map((letter) => (
                    <button
                      type="button"
                      key={letter}
                      onClick={() => {
                        const next = [...answerKey];
                        next[idx] = letter;
                        setAnswerKey(next);
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                        ans === letter ? 'bg-cyan-400 text-black' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-cyan-500/10">
          <button type="submit" disabled={saving} className="neon-btn w-full px-6 py-3 rounded-xl font-bold disabled:opacity-50">
            {saving ? 'جاري الحفظ...' : 'حفظ الواجب'}
          </button>
        </div>
      </form>

      <div className="neon-card rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-cyan-500/10">
          <h2 className="font-bold text-white">الواجبات المنشورة</h2>
        </div>
        <div className="divide-y divide-cyan-500/10">
          {homeworks.length === 0 ? (
            <div className="p-8 text-slate-400 text-center">لا توجد واجبات منشورة حتى الآن.</div>
          ) : (
            homeworks.map((hw: any) => (
              <div key={hw.id} className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="p-3 rounded-xl bg-cyan-400/10 text-cyan-300 border border-cyan-400/20 shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-white truncate">{lessonTitle(hw.lessonId)}</h4>
                    <p className="text-sm text-slate-400">{hw.numQuestions} سؤال</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(hw.id)}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                  title="حذف الواجب"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
