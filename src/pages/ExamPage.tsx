import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, CheckCircle, XCircle, Maximize2, X, ArrowRight, GraduationCap } from 'lucide-react';

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

const ANSWER_LABELS: Record<string, string> = { A: 'أ', B: 'ب', C: 'ج', D: 'د' };

interface Question {
  question: string;
  image: string | null;
}

interface Result {
  question: string;
  image: string | null;
  studentAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
}

type Step = 'code' | 'exam' | 'results';

export function ExamPage() {
  const [step, setStep] = useState<Step>('code');
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Step 1 — code
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);

  // Step 2 — exam
  const [lessonId, setLessonId] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [unanswered, setUnanswered] = useState(false);

  // Step 3 — results
  const [results, setResults] = useState<Result[]>([]);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);

  // Fullscreen image overlay
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);

  const navigate = useNavigate();

  // Check auth on mount
  useEffect(() => {
    fetch('/api/student/check-auth').then(res => {
      if (!res.ok) navigate('/');
    }).catch(() => navigate('/')).finally(() => setCheckingAuth(false));
  }, [navigate]);

  const handleCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidatingCode(true);
    setCodeError('');
    try {
      const res = await fetch('/api/student/exam/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setLessonId(data.lessonId);
        setQuestions(data.questions);
        setAnswers(Array(data.questions.length).fill(''));
        setStep('exam');
        window.scrollTo(0, 0);
      } else {
        setCodeError(data.error || 'كود غير صحيح');
      }
    } catch {
      setCodeError('حدث خطأ، تحقق من الاتصال');
    }
    setValidatingCode(false);
  };

  const handleSubmitExam = async () => {
    if (answers.includes('')) {
      setUnanswered(true);
      // Scroll to first unanswered
      const idx = answers.indexOf('');
      document.getElementById(`q-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setUnanswered(false);
    setSubmitting(true);
    try {
      const res = await fetch('/api/student/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, answers }),
      });
      const data = await res.json();
      if (res.ok) {
        setResults(data.results);
        setScore(data.score);
        setTotal(data.total);
        setStep('results');
        window.scrollTo(0, 0);
      } else {
        alert(data.error || 'حدث خطأ');
      }
    } catch {
      alert('حدث خطأ، تحقق من الاتصال');
    }
    setSubmitting(false);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        جاري التحقق...
      </div>
    );
  }

  /* ── Fullscreen image overlay ── */
  const FullscreenOverlay = fullscreenImg ? (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
      onClick={() => setFullscreenImg(null)}
    >
      <button
        className="absolute top-4 left-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
        onClick={() => setFullscreenImg(null)}
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={fullscreenImg}
        alt="صورة السؤال"
        className="max-w-full max-h-full object-contain rounded-xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  ) : null;

  /* ══════════════════════════════════════
     STEP 1 — Code Entry
  ══════════════════════════════════════ */
  if (step === 'code') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
        <div className="neon-card p-8 rounded-2xl max-w-md w-full">

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-full mx-auto mb-4">
              <img
                src="/logo.png"
                alt="YouChem Logo"
                className="w-full object-contain"
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center hidden mx-auto">
                <GraduationCap className="w-10 h-10 text-indigo-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">
              <span className="neon-text">الامتحان</span>
            </h1>
            <p className="text-sm text-slate-500">أدخل كود الامتحان الذي أعطاك إياه مستر أحمد</p>
          </div>

          {/* Key icon */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Key className="w-7 h-7 text-indigo-600" />
            </div>
          </div>

          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <input
              type="text"
              required
              placeholder="YCH-XXXXXX"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              className="neon-input w-full px-4 py-4 rounded-xl text-center font-mono text-xl uppercase tracking-widest"
              dir="ltr"
              autoComplete="off"
              autoFocus
            />
            {codeError && (
              <p className="text-red-500 text-sm font-semibold text-center">{codeError}</p>
            )}
            <button
              type="submit"
              disabled={validatingCode}
              className="neon-btn w-full py-4 rounded-xl font-bold text-base disabled:opacity-50"
            >
              {validatingCode ? 'جاري التحقق...' : 'دخول الامتحان'}
            </button>
          </form>

          {/* Back to dashboard */}
          <button
            onClick={() => navigate('/student-dashboard')}
            className="mt-6 w-full flex items-center justify-center gap-2 text-slate-400 hover:text-indigo-600 text-sm transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للداشبورد
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════
     STEP 2 — Exam Questions
  ══════════════════════════════════════ */
  if (step === 'exam') {
    return (
      <div className="min-h-screen bg-slate-50" dir="rtl">
        {FullscreenOverlay}

        {/* Header */}
        <header className="neon-panel border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="YouChem" className="h-7 object-contain" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
              <span className="font-bold text-slate-800 text-sm">الامتحان</span>
            </div>
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
              {questions.length} سؤال
            </span>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6 space-y-5 pb-32">
          {questions.map((q, idx) => {
            const isAnswered = answers[idx] !== '';
            const isMissing = unanswered && !isAnswered;
            return (
              <div
                id={`q-${idx}`}
                key={idx}
                className={`neon-card rounded-2xl p-5 space-y-4 transition-all ${isMissing ? 'ring-2 ring-red-400' : ''}`}
              >
                {/* Question header */}
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-slate-800 font-semibold leading-relaxed pt-1">{q.question}</p>
                </div>

                {/* Question image */}
                {q.image && (
                  <div className="relative group">
                    <img
                      src={q.image}
                      alt={`صورة السؤال ${idx + 1}`}
                      className="w-full max-h-72 object-contain rounded-xl border border-slate-200 bg-white cursor-pointer"
                      onClick={() => setFullscreenImg(q.image)}
                    />
                    <button
                      onClick={() => setFullscreenImg(q.image)}
                      className="absolute top-2 left-2 bg-black/40 hover:bg-black/60 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="تكبير"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Answer choices */}
                <div className="grid grid-cols-4 gap-2">
                  {ANSWER_LETTERS.map(letter => (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => {
                        const a = [...answers];
                        a[idx] = letter;
                        setAnswers(a);
                        if (unanswered) setUnanswered(false);
                      }}
                      className={`py-3 rounded-xl border-2 font-bold text-base transition-all min-h-[52px] active:scale-95 ${
                        answers[idx] === letter
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                      }`}
                    >
                      {letter}
                    </button>
                  ))}
                </div>

                {isMissing && (
                  <p className="text-red-500 text-xs font-semibold">⚠ الرجاء الإجابة على هذا السؤال</p>
                )}
              </div>
            );
          })}
        </main>

        {/* Sticky submit bar */}
        <div className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-sm border-t border-slate-200 p-4 z-10">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={handleSubmitExam}
              disabled={submitting}
              className="neon-btn w-full py-4 rounded-xl font-bold text-base disabled:opacity-50"
            >
              {submitting ? 'جاري الإرسال...' : 'تصحيح الامتحان ✓'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════
     STEP 3 — Corrected Results
  ══════════════════════════════════════ */
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = score >= Math.ceil(total / 2);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {FullscreenOverlay}

      {/* Header */}
      <header className="neon-panel border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="YouChem" className="h-7 object-contain" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
            <span className="font-bold text-slate-800 text-sm">نتيجة الامتحان</span>
          </div>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
            {score} / {total}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5 pb-12">

        {/* Score card */}
        <div className={`neon-card rounded-2xl p-6 text-center border-2 ${passed ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
          <p className={`text-6xl font-extrabold mb-1 ${passed ? 'text-emerald-600' : 'text-red-500'}`}>
            {score}<span className="text-3xl font-bold text-slate-400">/{total}</span>
          </p>
          <p className="text-slate-500 text-sm mb-3">{pct}%</p>
          <p className={`font-bold text-base ${passed ? 'text-emerald-700' : 'text-red-600'}`}>
            {passed ? '🎉 أحسنت! لقد اجتزت الامتحان' : '❌ لم تجتز الامتحان — راجع إجاباتك أدناه'}
          </p>
        </div>

        {/* Per-question results */}
        {results.map((r, idx) => (
          <div
            key={idx}
            className={`neon-card rounded-2xl p-5 space-y-4 border-r-4 ${r.isCorrect ? 'border-r-emerald-400' : 'border-r-red-400'}`}
          >
            {/* Question header */}
            <div className="flex items-start gap-3">
              <span className={`w-8 h-8 rounded-full font-bold text-sm flex items-center justify-center shrink-0 mt-0.5 ${
                r.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
              }`}>
                {idx + 1}
              </span>
              <p className="text-slate-800 font-semibold leading-relaxed pt-1 flex-1">{r.question}</p>
              <div className="shrink-0 mt-0.5">
                {r.isCorrect
                  ? <CheckCircle className="w-6 h-6 text-emerald-500" />
                  : <XCircle className="w-6 h-6 text-red-500" />}
              </div>
            </div>

            {/* Question image */}
            {r.image && (
              <div className="relative group">
                <img
                  src={r.image}
                  alt={`صورة السؤال ${idx + 1}`}
                  className="w-full max-h-80 object-contain rounded-xl border border-slate-200 bg-white cursor-pointer"
                  onClick={() => setFullscreenImg(r.image)}
                />
                <button
                  onClick={() => setFullscreenImg(r.image)}
                  className="absolute top-2 left-2 bg-black/40 hover:bg-black/60 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity"
                  title="عرض بالكامل"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 rounded-md px-2 py-0.5 hidden sm:inline">
                  اضغط للتكبير
                </span>
              </div>
            )}

            {/* Answers */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className={`flex items-center gap-2 rounded-xl px-4 py-3 font-bold ${
                r.isCorrect ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
              }`}>
                <span className="text-xs text-slate-500 font-normal">إجابتك:</span>
                <span>{r.studentAnswer ?? '—'}</span>
                {r.studentAnswer && <span className="text-xs opacity-60">({ANSWER_LABELS[r.studentAnswer] ?? ''})</span>}
              </div>
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span className="text-xs text-slate-500 font-normal">الصحيحة:</span>
                <span>{r.correctAnswer}</span>
                <span className="text-xs opacity-60">({ANSWER_LABELS[r.correctAnswer] ?? ''})</span>
              </div>
            </div>
          </div>
        ))}

        {/* Start new exam button */}
        <button
          onClick={() => { setStep('code'); setCode(''); setCodeError(''); setResults([]); }}
          className="neon-btn w-full py-4 rounded-xl font-bold text-base mt-4"
        >
          امتحان جديد
        </button>
      </main>
    </div>
  );
}
