import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { FileText, Trash2, UploadCloud } from 'lucide-react';

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

const GRADE_LABEL: Record<string, string> = {
  '2nd_sec': 'تاني ثانوي',
  '3rd_sec': 'تالت ثانوي',
};

export function Homework() {
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [gradeLevel, setGradeLevel] = useState<'2nd_sec' | '3rd_sec'>('2nd_sec');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numQuestions, setNumQuestions] = useState(10);
  const [answerKey, setAnswerKey] = useState<string[]>(Array(10).fill('A'));
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchHomeworks(); }, []);

  const fetchHomeworks = async () => {
    try {
      const res = await fetch('/api/youchem/homeworks');
      if (res.ok) setHomeworks(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleNumQuestionsChange = (value: number) => {
    const n = Math.max(1, Math.min(100, value || 1));
    setNumQuestions(n);
    setAnswerKey(prev => {
      const next = [...prev];
      if (n > next.length) while (next.length < n) next.push('A');
      else next.length = n;
      return next;
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') return alert('لازم تختار ملف PDF بس');
    if (file.size > 25 * 1024 * 1024) return alert('حجم الملف كبير جداً (الحد 25 ميجا)');
    setPdfFile(file);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert('لازم تكتب عنوان للواجب');
    if (!pdfFile) return alert('لازم تختار ملف PDF');
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('gradeLevel', gradeLevel);
      formData.append('numQuestions', String(numQuestions));
      formData.append('answerKey', JSON.stringify(answerKey));
      formData.append('pdf', pdfFile);
      const res = await fetch('/api/youchem/homework', { method: 'POST', body: formData });
      if (res.ok) {
        alert('اتحفظ الواجب بنجاح');
        setTitle('');
        setPdfFile(null);
        setNumQuestions(10);
        setAnswerKey(Array(10).fill('A'));
        fetchHomeworks();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'في مشكلة');
      }
    } catch { alert('في مشكلة في حفظ الواجب'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('متأكد إنك تمسح الواجب ده؟')) return;
    try {
      const res = await fetch(`/api/youchem/homework/${id}`, { method: 'DELETE' });
      if (res.ok) fetchHomeworks();
    } catch { alert('فشل المسح'); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">إدارة الواجبات</h1>
        <p className="text-slate-500 text-sm mt-0.5">ارفع ملف PDF وحدد إجابات النموذج</p>
      </div>

      <form onSubmit={handleSave} className="neon-card p-6 rounded-2xl space-y-6">

        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">عنوان الواجب</label>
          <input
            type="text" required placeholder="مثال: واجب الفصل الأول — الجدول الدوري"
            value={title} onChange={e => setTitle(e.target.value)}
            className="neon-input w-full px-4 py-2.5 rounded-xl text-sm"
          />
        </div>

        {/* Grade level */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">الصف الدراسي</label>
          <select value={gradeLevel} onChange={e => setGradeLevel(e.target.value as any)} className="neon-input w-full px-4 py-2.5 rounded-xl text-sm">
            <option value="2nd_sec">تاني ثانوي</option>
            <option value="3rd_sec">تالت ثانوي</option>
          </select>
        </div>

        {/* PDF */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">ملف الواجب (PDF)</label>
          {pdfFile ? (
            <div className="flex items-center justify-between gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                <span className="text-slate-800 text-sm font-semibold truncate">{pdfFile.name}</span>
              </div>
              <button type="button" onClick={() => setPdfFile(null)} className="text-red-500 hover:text-red-600 text-sm font-semibold shrink-0">شيله</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full py-10 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors">
              <UploadCloud className="w-7 h-7 text-slate-400 mb-2" />
              <span className="text-sm text-slate-500">اضغط علشان ترفع PDF</span>
              <input type="file" accept="application/pdf,.pdf" onChange={handleFileChange} className="hidden" />
            </label>
          )}
        </div>

        {/* Num questions */}
        <div className="max-w-xs">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">عدد الأسئلة</label>
          <input type="number" min={1} max={100} value={numQuestions} onChange={e => handleNumQuestionsChange(parseInt(e.target.value, 10))}
            className="neon-input w-full px-4 py-2.5 rounded-xl text-sm" />
        </div>

        {/* Answer key */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">نموذج الإجابات</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {answerKey.map((ans, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-500">سؤال {idx + 1}</span>
                <div className="flex gap-1">
                  {ANSWER_LETTERS.map(letter => (
                    <button type="button" key={letter}
                      onClick={() => { const next = [...answerKey]; next[idx] = letter; setAnswerKey(next); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        ans === letter ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
                      }`}
                    >{letter}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <button type="submit" disabled={saving} className="neon-btn w-full px-6 py-3 rounded-xl font-bold disabled:opacity-50">
            {saving ? 'بيتحفظ...' : 'احفظ الواجب'}
          </button>
        </div>
      </form>

      {/* Published homeworks */}
      <div className="neon-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-900 text-sm">الواجبات المنشورة</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {homeworks.length === 0 ? (
            <div className="p-10 text-slate-400 text-center text-sm">مفيش واجبات منشورة لحد دلوقتي.</div>
          ) : homeworks.map((hw: any) => (
            <div key={hw.id} className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 text-sm truncate">{hw.title || '—'}</h4>
                  <p className="text-xs text-slate-400">{GRADE_LABEL[hw.gradeLevel] || hw.gradeLevel} · {hw.numQuestions} سؤال</p>
                </div>
              </div>
              <button onClick={() => handleDelete(hw.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0" title="حذف">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
