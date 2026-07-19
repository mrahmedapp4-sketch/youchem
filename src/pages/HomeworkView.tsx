import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, Download, CheckCircle, XCircle } from 'lucide-react';

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

export function HomeworkView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [homework, setHomework] = useState<any>(null);
  const [pastResult, setPastResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [answers, setAnswers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const fetchHomework = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/student/homework/${id}`);
        if (!res.ok) { navigate('/student-dashboard'); return; }
        const data = await res.json();
        if (!data.homework) { navigate('/student-dashboard'); return; }
        setHomework(data.homework);
        setAnswers(Array(data.homework.numQuestions).fill(''));
        if (data.pastResult) setPastResult(data.pastResult);
      } catch { navigate('/student-dashboard'); }
      setLoading(false);
    };
    fetchHomework();
  }, [id, navigate]);

  const handleSubmit = async () => {
    if (answers.includes('')) return alert('الرجاء الإجابة على جميع الأسئلة');
    setSubmitting(true);
    try {
      const res = await fetch('/api/student/submit-homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeworkId: id, answers }),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else alert(data.error || 'حدث خطأ');
    } catch { alert('حدث خطأ'); }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-slate-400">جاري التحميل...</div>
  );

  const displayed = result || pastResult;

  return (
    <div className="min-h-screen" dir="rtl">

      {/* Header */}
      <header className="neon-panel border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate('/student-dashboard')}
            className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-600 shrink-0"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-indigo-600" />
            </div>
            <h1 className="font-bold text-slate-900 text-sm sm:text-base truncate">{homework?.title}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-5 sm:py-8 space-y-5">

        {/* PDF download */}
        <div className="neon-card p-4 sm:p-5 rounded-2xl flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-900 text-sm sm:text-base truncate">{homework?.title}</h2>
            <p className="text-slate-500 text-xs sm:text-sm">{homework?.numQuestions} سؤال</p>
          </div>
          <a
            href={homework?.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="neon-btn inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl font-bold text-sm shrink-0"
          >
            <Download className="w-4 h-4" />
            <span className="hidden xs:inline">تحميل</span>
            <span className="xs:hidden">PDF</span>
          </a>
        </div>

        {/* Result */}
        {displayed ? (
          <div className="neon-card p-4 sm:p-6 rounded-2xl space-y-5">
            <div className="p-5 sm:p-6 rounded-2xl border bg-indigo-50 border-indigo-200 text-center">
              <p className="text-slate-600 text-sm mb-1">درجتك في الواجب</p>
              <p className="text-4xl sm:text-5xl font-extrabold text-indigo-700">
                {displayed.score} / {displayed.total}
              </p>
              <p className="text-slate-500 mt-1">({Math.round((displayed.score / displayed.total) * 100)}%)</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(displayed.results || []).map((r: any) => (
                <div
                  key={r.questionNumber}
                  className={`p-4 rounded-xl border space-y-1.5 ${r.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}
                >
                  <div className="flex items-center gap-2">
                    {r.isCorrect
                      ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                    <span className="font-bold text-slate-800 text-sm">سؤال {r.questionNumber}</span>
                  </div>
                  {!r.isCorrect && (
                    <p className="text-red-600 text-sm">إجابتك: {r.studentAnswer || 'لم تجب'}</p>
                  )}
                  <p className="text-emerald-700 text-sm font-semibold">الصحيحة: {r.correctAnswer}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Answer form */
          <div className="neon-card p-4 sm:p-6 rounded-2xl space-y-4 sm:space-y-5">
            <div>
              <h2 className="font-bold text-slate-900 text-base sm:text-lg">سجّل إجاباتك</h2>
              <p className="text-slate-500 text-sm mt-1">حمّل الواجب، حله على الورق، ثم اختر إجابة كل سؤال هنا للتصحيح.</p>
            </div>

            {/* Question grid — 1 col on mobile, 2 on sm, 3 on md */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: homework?.numQuestions || 0 }).map((_, idx) => (
                <div key={idx} className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <span className="text-sm font-bold text-slate-600">سؤال {idx + 1}</span>
                  {/* A / B / C / D — large tap targets */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {ANSWER_LETTERS.map(letter => (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => { const a = [...answers]; a[idx] = letter; setAnswers(a); }}
                        className={`py-3 rounded-xl text-sm font-bold transition-colors min-h-[48px] ${
                          answers[idx] === letter
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 active:bg-indigo-50'
                        }`}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-200">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="neon-btn w-full py-3.5 rounded-xl font-bold text-base disabled:opacity-50"
              >
                {submitting ? 'جاري التصحيح...' : 'تصحيح الواجب'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
