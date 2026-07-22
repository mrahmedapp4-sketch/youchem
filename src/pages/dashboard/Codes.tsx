import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, CheckCircle, BookOpen } from 'lucide-react';

export function Codes() {
  const [count, setCount] = useState(50);
  const [lessonId, setLessonId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [codesList, setCodesList] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCodes(), fetchLessons()]);
  }, []);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/youchem/codes');
      if (res.ok) {
        const data = await res.json();
        data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCodesList(data);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchLessons = async () => {
    try {
      const res = await fetch('/api/youchem/lessons');
      if (res.ok) {
        const data = await res.json();
        setLessons(data.lessons || data || []);
      }
    } catch (err) { console.error(err); }
  };

  const handleGenerate = async () => {
    if (!lessonId) {
      alert('لازم تختار الحصة المرتبطة بالكود قبل التوليد');
      return;
    }
    setIsGenerating(true); setGeneratedMessage('');
    try {
      const res = await fetch('/api/youchem/codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, lessonId }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedMessage(`اتعمل ${data.generated} كود بنجاح لـ "${getLessonTitle(lessonId)}".`);
        fetchCodes();
      }
    } catch { alert('في مشكلة في الإنشاء'); }
    setIsGenerating(false);
  };

  const handleBurnCode = async (id: string) => {
    if (!confirm('متأكد إنك تمسح الكود ده نهائياً؟')) return;
    try {
      const res = await fetch(`/api/youchem/codes/${id}`, { method: 'DELETE' });
      if (res.ok) setCodesList(codesList.filter(c => c.id !== id));
    } catch { alert('فشل مسح الكود'); }
  };

  const getLessonTitle = (lId?: string) => {
    if (!lId) return null;
    const l = lessons.find((x: any) => x.id === lId);
    return l?.title || lId;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">أكواد الوصول</h1>
          <p className="text-slate-500 text-sm mt-0.5">توليد وإدارة الأكواد للطلاب</p>
        </div>

        {/* Generate controls */}
        <div className="neon-card rounded-2xl p-4 flex flex-col gap-3 min-w-[260px]" dir="rtl">
          {/* Lesson picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">الامتحان المرتبط بالكود</label>
            <div className="relative">
              <BookOpen className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={lessonId}
                onChange={e => setLessonId(e.target.value)}
                className="neon-input w-full pr-9 pl-3 py-2.5 rounded-xl text-sm appearance-none"
              >
                <option value="">— اختر الحصة (مطلوب) —</option>
                {lessons.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Count + generate button */}
          <div className="flex items-center gap-2">
            <input
              type="number" value={count} onChange={e => setCount(Number(e.target.value))}
              min="1" max="500"
              className="neon-input w-24 px-3 py-2 rounded-xl text-sm text-center"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="neon-btn flex-1 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {isGenerating
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Plus className="w-4 h-4" />
              }
              توليد
            </button>
          </div>
        </div>
      </div>

      {generatedMessage && (
        <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="font-semibold text-sm">{generatedMessage}</span>
        </div>
      )}

      {/* Table */}
      <div className="neon-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">بيتحمل...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3">الكود</th>
                  <th className="px-5 py-3">الامتحان</th>
                  <th className="px-5 py-3">الحالة</th>
                  <th className="px-5 py-3">الطالب</th>
                  <th className="px-5 py-3">تاريخ الإنشاء</th>
                  <th className="px-5 py-3 text-center w-16">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {codesList.length === 0 && (
                  <tr><td colSpan={6} className="p-10 text-center text-slate-400 text-sm">مفيش أكواد اتعملت.</td></tr>
                )}
                {codesList.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-slate-800 font-semibold text-sm">
                      <div className="flex items-center gap-2">
                        <Key className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        {c.codeString}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm max-w-[180px]">
                      {c.lessonId ? (
                        <span className="text-indigo-700 font-medium truncate block">{getLessonTitle(c.lessonId)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {c.isUsed ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />اتاستخدم
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />متاح
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 text-sm font-medium truncate max-w-[200px]">
                      {c.usedByName || (c.usedBy ? c.usedBy : '—')}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-sm">
                      {new Date(c.createdAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => handleBurnCode(c.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mx-auto flex" title="حذف نهائي">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
