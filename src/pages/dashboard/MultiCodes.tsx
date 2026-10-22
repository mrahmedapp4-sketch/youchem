import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle, Copy, FileDown, Layers, Plus, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Lesson {
  id: string;
  title: string;
  gradeLevel: string;
  isHidden?: boolean;
}

interface MultiCode {
  id: string;
  codeString: string;
  kind?: string;
  lessonIds?: string[];
  isUsed: boolean;
  usedByName?: string | null;
  createdAt: string;
}

export function MultiCodes() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [codes, setCodes] = useState<MultiCode[]>([]);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [count, setCount] = useState(50);
  const [lastBatch, setLastBatch] = useState<MultiCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [codesResponse, lessonsResponse] = await Promise.all([
        fetch('/api/youchem/codes'),
        fetch('/api/youchem/lessons'),
      ]);
      if (!codesResponse.ok || !lessonsResponse.ok) {
        throw new Error('فشل تحميل الأكواد أو الحصص');
      }

      const [allCodes, lessonData] = await Promise.all([
        codesResponse.json(),
        lessonsResponse.json(),
      ]);
      setCodes(
        (Array.isArray(allCodes) ? allCodes : [])
          .filter((code: MultiCode) => code.kind === 'multi')
          .sort((a: MultiCode, b: MultiCode) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      );
      setLessons(lessonData.lessons || lessonData || []);
    } catch (loadError) {
      console.error(loadError);
      setError('في مشكلة في تحميل بيانات الأكواد. جرّب تحديث الصفحة.');
    } finally {
      setLoading(false);
    }
  };

  const selectedLessons = useMemo(
    () => lessons.filter(lesson => selectedLessonIds.includes(lesson.id)),
    [lessons, selectedLessonIds],
  );
  const hasMixedGrades = new Set(selectedLessons.map(lesson => lesson.gradeLevel)).size > 1;
  const canGenerate = selectedLessonIds.length > 0
    && !hasMixedGrades
    && Number.isInteger(count)
    && count >= 1
    && count <= 500
    && !isGenerating;

  const getLessonTitle = (lessonId: string) =>
    lessons.find(lesson => lesson.id === lessonId)?.title || 'حصة محذوفة';

  const toggleLesson = (lessonId: string) => {
    setSelectedLessonIds(current => current.includes(lessonId)
      ? current.filter(id => id !== lessonId)
      : [...current, lessonId]);
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/youchem/codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'multi', count, lessonIds: selectedLessonIds }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'في مشكلة في إنشاء الأكواد');
        return;
      }

      const batch: MultiCode[] = Array.isArray(data.codes) ? data.codes : [];
      setLastBatch(batch);
      setSuccess(`اتعمل ${data.generated} كود، وكل كود هيفتح الحصص المحددة فقط.`);
      await loadData();
    } catch {
      setError('في مشكلة في الاتصال أثناء إنشاء الأكواد');
    } finally {
      setIsGenerating(false);
    }
  };

  const exportCodes = (exportCodesList: MultiCode[], fileSuffix: string) => {
    if (exportCodesList.length === 0) {
      setError('مفيش أكواد متاحة للتصدير');
      return;
    }

    const rows = [
      ['الكود', 'الحصص التي يفتحها', 'الصف الدراسي', 'الحالة', 'تاريخ الإنشاء'],
      ...exportCodesList.map(code => {
        const linkedLessons = (code.lessonIds || [])
          .map(getLessonTitle)
          .join('، ');
        const grade = lessons.find(lesson => (code.lessonIds || []).includes(lesson.id))?.gradeLevel;
        return [
          code.codeString,
          linkedLessons,
          grade === '2nd_sec' ? 'تاني ثانوي' : grade === '3rd_sec' ? 'تالت ثانوي' : '',
          code.isUsed ? `مستخدم${code.usedByName ? ` — ${code.usedByName}` : ''}` : 'متاح',
          new Date(code.createdAt).toLocaleString('ar-EG'),
        ];
      }),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [{ wch: 22 }, { wch: 48 }, { wch: 18 }, { wch: 24 }, { wch: 24 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'الأكواد المتعددة');
    XLSX.writeFile(workbook, `youchem-multi-codes-${fileSuffix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleDelete = async (code: MultiCode) => {
    if (!window.confirm(`متأكد إنك تمسح الكود ${code.codeString}؟`)) return;
    try {
      const response = await fetch(`/api/youchem/codes/${code.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('فشل حذف الكود');
      setCodes(current => current.filter(item => item.id !== code.id));
      setLastBatch(current => current.filter(item => item.id !== code.id));
    } catch {
      setError('فشل حذف الكود');
    }
  };

  const handleCopy = async (code: MultiCode) => {
    try {
      await navigator.clipboard.writeText(code.codeString);
      setCopiedId(code.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setError('لم أتمكن من نسخ الكود. حدده وانسخه يدويًا.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6" dir="rtl">
      <header>
        <h1 className="text-xl font-bold text-slate-900">الأكواد المتعددة</h1>
        <p className="mt-1 text-sm text-slate-500">
          ولّد أكوادًا تفتح مجموعة حصص تختارها، والطالب يدخلها من قسم Promo Code.
        </p>
      </header>

      <section className="neon-card rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">إعداد دفعة الأكواد</h2>
            <p className="text-sm text-slate-500 mt-1">
              كل كود يُستخدم مرة واحدة ويفتح الحصص المحددة فقط، من غير فتح الحصص الجديدة تلقائيًا.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="block">
            <span className="block text-xs font-semibold text-slate-600 mb-1.5">عدد الأكواد</span>
            <input
              type="number"
              min="1"
              max="500"
              step="1"
              value={count}
              onChange={event => setCount(Number(event.target.value))}
              className="neon-input w-full sm:w-36 px-3 py-2.5 rounded-xl text-sm text-center"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={!canGenerate}
            className="neon-btn px-5 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Plus className="w-4 h-4" />}
            توليد الأكواد
          </button>
          <span className="text-xs text-slate-500">
            المحدد: {selectedLessonIds.length} حصة · الحد الأقصى 500 كود
          </span>
        </div>

        {hasMixedGrades && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            اختار حصصًا من نفس الصف الدراسي عشان الكود يشتغل عند الطالب المناسب.
          </p>
        )}

        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="text-sm font-bold text-slate-700">اختار الحصص التي سيفتحها الكود</h3>
            {selectedLessonIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedLessonIds([])}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                إلغاء التحديد
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">بيتحمل...</div>
          ) : lessons.length === 0 ? (
            <div className="p-8 text-center text-slate-400 neon-panel rounded-xl">مفيش حصص متاحة للاختيار.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto p-1">
              {lessons.map(lesson => (
                <label
                  key={lesson.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selectedLessonIds.includes(lesson.id)
                      ? 'bg-indigo-50 border-indigo-200'
                      : 'bg-white border-slate-200 hover:border-indigo-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedLessonIds.includes(lesson.id)}
                    onChange={() => toggleLesson(lesson.id)}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <BookOpen className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-800">{lesson.title}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      {lesson.gradeLevel === '2nd_sec' ? 'تاني ثانوي' : 'تالت ثانوي'}
                      {lesson.isHidden ? ' · مخفية' : ''}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </section>

      {success && (
        <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="font-semibold text-sm">{success}</span>
        </div>
      )}
      {error && (
        <p role="alert" className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-semibold">
          {error}
        </p>
      )}

      <section className="neon-card rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">الأكواد المتولدة</h2>
            <p className="text-xs text-slate-500 mt-1">
              {codes.filter(code => !code.isUsed).length} كود متاح من أصل {codes.length}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lastBatch.length > 0 && (
              <button
                type="button"
                onClick={() => exportCodes(lastBatch, 'latest-batch')}
                className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-200"
              >
                <FileDown className="w-4 h-4" />
                تصدير آخر دفعة (.xlsx)
              </button>
            )}
            <button
              type="button"
              onClick={() => exportCodes(codes.filter(code => !code.isUsed), 'available')}
              disabled={!codes.some(code => !code.isUsed)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200 disabled:opacity-40"
            >
              <FileDown className="w-4 h-4" />
              تصدير الأكواد المتاحة (.xlsx)
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400">بيتحمل...</div>
        ) : codes.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">لسه مفيش أكواد متعددة.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {codes.map(code => (
              <div key={code.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code dir="ltr" className="font-mono font-bold tracking-wide text-slate-800">{code.codeString}</code>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                      code.isUsed ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {code.isUsed ? `مستخدم${code.usedByName ? ` · ${code.usedByName}` : ''}` : 'متاح'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {(code.lessonIds || []).map(getLessonTitle).join('، ')}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {new Date(code.createdAt).toLocaleString('ar-EG')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleCopy(code)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                    title={copiedId === code.id ? 'تم النسخ' : 'نسخ الكود'}
                    aria-label={copiedId === code.id ? 'تم النسخ' : 'نسخ الكود'}
                  >
                    {copiedId === code.id ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(code)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="حذف الكود"
                    aria-label="حذف الكود"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
