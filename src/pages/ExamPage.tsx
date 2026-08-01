import { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Key, CheckCircle, XCircle, Maximize2, X,
  BookOpen, GraduationCap, ArrowRight, Clock,
} from 'lucide-react';

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];
const ANSWER_LABELS: Record<string, string> = { A: 'أ', B: 'ب', C: 'ج', D: 'د' };

interface Question  { question: string; image: string | null; }
interface Result    { question: string; image: string | null; studentAnswer: string | null; correctAnswer: string; isCorrect: boolean; }

type Step = 'lesson' | 'code' | 'exam' | 'results' | 'access';

export function ExamPage() {
  const navigate = useNavigate();

  const [checkingAuth, setCheckingAuth] = useState(true);

  /* ── Step 1: lesson picker ── */
  const [lessons, setLessons]           = useState<any[]>([]);
  const [accesses, setAccesses]         = useState<any[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);

  /* ── Step 2: code entry ── */
  const [code, setCode]       = useState('');
  const [codeError, setCodeError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  /* ── Step 3: exam ── */
  const [lessonId, setLessonId]   = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers]     = useState<string[]>([]);
  const [submitting, setSubmitting]   = useState(false);
  const [unanswered, setUnanswered]   = useState(false);
  const [timeLeft, setTimeLeft]   = useState<number | null>(null); // seconds, null = no limit
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Step 4: results ── */
  const [results, setResults] = useState<Result[]>([]);
  const [score, setScore]     = useState(0);
  const [total, setTotal]     = useState(0);

  /* ── Fullscreen overlay ── */
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);

  /* ── Active step ── */
  const [step, setStep] = useState<Step>('lesson');

  /* ── Keyboard navigation ── */
  const [focusedLessonIdx, setFocusedLessonIdx] = useState(0);
  const [focusedQIdx, setFocusedQIdx]           = useState(0);
  const lessonBtnRefs  = useRef<(HTMLButtonElement | null)[]>([]);
  const questionDivRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* ── Auth check + load lessons ── */
  useEffect(() => {
    fetch('/api/student/check-auth')
      .then(r => { if (!r.ok) navigate('/'); })
      .catch(() => navigate('/'))
      .finally(() => setCheckingAuth(false));

    fetch('/api/student/lessons')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setLessons(data.lessons || []);
          setAccesses(data.accesses || []);
        }
      })
      .catch(() => {})
      .finally(() => setLessonsLoading(false));
  }, [navigate]);

  /* ── Timer ── */
  useEffect(() => {
    if (step === 'exam' && timeLeft !== null && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null) return null;
          if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step, timeLeft !== null]);

  // auto-submit when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && step === 'exam' && !submitting) {
      handleSubmitExam();
    }
  }, [timeLeft]);

  /* ── Lesson picker: focus the highlighted button ── */
  useEffect(() => {
    if (step === 'lesson') lessonBtnRefs.current[focusedLessonIdx]?.focus();
  }, [focusedLessonIdx, step]);

  /* ── Exam: arrow keys navigate questions/answers, Enter advances ── */
  useEffect(() => {
    if (step !== 'exam') return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Left/Right → cycle A B C D for the focused question
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setAnswers(prev => {
          const cur = ANSWER_LETTERS.indexOf(prev[focusedQIdx] ?? '');
          const dir = e.key === 'ArrowRight' ? 1 : -1;
          const next = cur === -1 ? 0 : Math.max(0, Math.min(ANSWER_LETTERS.length - 1, cur + dir));
          const a = [...prev]; a[focusedQIdx] = ANSWER_LETTERS[next]; return a;
        });
        setUnanswered(false);
      }
      // Up/Down → move between questions
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedQIdx(prev => {
          const next = Math.max(0, Math.min(questions.length - 1, prev + (e.key === 'ArrowDown' ? 1 : -1)));
          questionDivRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return next;
        });
      }
      // Enter → jump to next unanswered, or submit if all answered
      if (e.key === 'Enter') {
        e.preventDefault();
        setAnswers(prev => {
          const nextBlank = prev.findIndex((a, i) => i > focusedQIdx && a === '');
          if (nextBlank !== -1) {
            setFocusedQIdx(nextBlank);
            questionDivRefs.current[nextBlank]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else if (!prev.includes('')) {
            handleSubmitExam();
          }
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, questions.length, focusedQIdx]);

  /* ── Helpers ── */
  const goNewExam = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCode(''); setCodeError('');
    setSelectedLesson(null);
    setQuestions([]); setAnswers([]);
    setResults([]); setScore(0); setTotal(0);
    setTimeLeft(null);
    setStep('lesson');
    window.scrollTo(0, 0);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  /* ── Step 1 → 2: pick lesson ── */
  const handleLessonPick = (lesson: any) => {
    setSelectedLesson(lesson);
    setCode(''); setCodeError('');
    setStep('code');
    window.scrollTo(0, 0);
  };

  /* ── Step 2 → 3/access: submit code ── */
  const handleCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCodeError('');
    setUnlocking(true);
    try {
      const res = await fetch('/api/student/exam/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), lessonId: selectedLesson.id }),
      });
      const data = await res.json();
      if (!res.ok) { setCodeError(data.error || 'حدث خطأ'); setUnlocking(false); return; }

      setLessonId(selectedLesson.id);
      if (data.quizExists) {
        setQuestions(data.questions);
        setAnswers(Array(data.questions.length).fill(''));
        setTimeLeft(data.examDurationMinutes > 0 ? data.examDurationMinutes * 60 : null);
        setStep('exam');
      } else {
        setStep('access');
      }
      window.scrollTo(0, 0);
    } catch {
      setCodeError('حدث خطأ، تحقق من الاتصال');
    }
    setUnlocking(false);
  };

  /* ── Step 3 → 4: submit exam ── */
  const handleSubmitExam = async () => {
    if (answers.includes('')) {
      setUnanswered(true);
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

  /* ════════════════════════════════════════════════════ */

  if (checkingAuth) return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">جاري التحقق...</div>
  );

  /* ── Fullscreen overlay ── */
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
     STEP 1 — Lesson Picker
  ══════════════════════════════════════ */
  if (step === 'lesson') {
    const accessedIds = new Set(accesses.map((a: any) => a.lessonId));
    return (
      <div className="min-h-screen bg-slate-50" dir="rtl">
        <header className="neon-panel border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png" alt="يوكيم"
                className="h-7 object-contain"
                onError={e => (e.target as HTMLImageElement).style.display = 'none'}
              />
              <span className="font-bold text-slate-800 text-sm">اختر الحصة</span>
            </div>
            <button
              onClick={() => navigate('/student-dashboard')}
              className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              الداشبورد
            </button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6">
          <p className="text-slate-500 text-sm mb-5 text-center">
            اختر الحصة التي تريد فتحها
          </p>

          {lessonsLoading ? (
            <div className="text-center p-12 text-slate-400">جاري التحميل...</div>
          ) : lessons.length === 0 ? (
            <div className="text-center p-12 text-slate-400">لا توجد حصص متاحة.</div>
          ) : (
            <div className="space-y-3">
              {lessons.map((lesson: any, idx: number) => {
                const hasAccess = accessedIds.has(lesson.id);
                const isFocused = focusedLessonIdx === idx;
                return (
                  <button
                    key={lesson.id}
                    ref={el => { lessonBtnRefs.current[idx] = el; }}
                    tabIndex={isFocused ? 0 : -1}
                    onClick={() => handleLessonPick(lesson)}
                    onMouseEnter={() => setFocusedLessonIdx(idx)}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedLessonIdx(i => Math.min(i + 1, lessons.length - 1)); }
                      if (e.key === 'ArrowUp')   { e.preventDefault(); setFocusedLessonIdx(i => Math.max(i - 1, 0)); }
                    }}
                    className={`w-full neon-card rounded-2xl p-5 flex items-center gap-4 text-right transition-all hover:ring-2 hover:ring-indigo-200 active:scale-[0.99] ${isFocused ? 'ring-2 ring-indigo-400' : ''}`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      hasAccess ? 'bg-emerald-50 border border-emerald-200' : 'bg-indigo-50 border border-indigo-100'
                    }`}>
                      {hasAccess
                        ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                        : <BookOpen className="w-5 h-5 text-indigo-500" />}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <p className="font-bold text-slate-800 text-sm leading-snug">{lesson.title}</p>
                      {hasAccess && (
                        <p className="text-xs text-emerald-600 font-semibold mt-0.5">مفتوحة مسبقاً</p>
                      )}
                    </div>
                    <Key className="w-4 h-4 text-slate-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>
    );
  }

  /* ══════════════════════════════════════
     STEP 2 — Code Entry
  ══════════════════════════════════════ */
  if (step === 'code') return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
      <div className="neon-card p-8 rounded-2xl max-w-md w-full">

        {/* Logo */}
        <div className="text-center mb-6">
          <img
            src="/logo.png" alt="يوكيم"
            className="h-14 object-contain mx-auto mb-4"
            onError={e => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center hidden mx-auto mb-4">
            <GraduationCap className="w-6 h-6 text-indigo-600" />
          </div>

          {/* Selected lesson name */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-2">
            <p className="text-xs text-indigo-400 font-semibold mb-0.5">الحصة المختارة</p>
            <p className="font-bold text-indigo-800 text-sm">{selectedLesson?.title}</p>
          </div>
        </div>

        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <Key className="w-7 h-7 text-indigo-600" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-slate-900 text-center mb-1">كود الوصول</h2>
        <p className="text-sm text-slate-500 text-center mb-6">أدخل الكود الذي أعطاك إياه مستر أحمد</p>

        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <input
            type="text" required
            placeholder="YCH-XXXXXX"
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setCodeError(''); }}
            className="neon-input w-full px-4 py-4 rounded-xl text-center font-mono text-xl uppercase tracking-widest"
            dir="ltr" autoComplete="off" autoFocus
          />
          {codeError && <p className="text-red-500 text-sm font-semibold text-center">{codeError}</p>}
          <button
            type="submit"
            disabled={unlocking || !code.trim()}
            className="neon-btn w-full py-4 rounded-xl font-bold text-base disabled:opacity-50"
          >
            {unlocking
              ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> جاري التحقق...</span>
              : 'تفعيل الكود'}
          </button>
        </form>

        <button
          onClick={() => setStep('lesson')}
          className="mt-5 w-full flex items-center justify-center gap-2 text-slate-400 hover:text-indigo-600 text-sm transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          اختيار حصة أخرى
        </button>
      </div>
    </div>
  );

  /* ══════════════════════════════════════
     STEP 3 — Exam Questions
  ══════════════════════════════════════ */
  if (step === 'exam') return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {FullscreenOverlay}

      <header className="neon-panel border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">{selectedLesson?.title}</p>
            <p className="text-xs text-slate-400">امتحان الحصة</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {timeLeft !== null && (
              <span className={`flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-full ${
                timeLeft <= 60 ? 'bg-red-100 text-red-600 animate-pulse' :
                timeLeft <= 180 ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                {formatTime(timeLeft)}
              </span>
            )}
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
              {questions.length} سؤال
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5 pb-32">
        {questions.map((q, idx) => {
          const isAnswered = answers[idx] !== '';
          const isMissing  = unanswered && !isAnswered;
          const isFocusedQ = focusedQIdx === idx;
          return (
            <div
              id={`q-${idx}`} key={idx}
              ref={el => { questionDivRefs.current[idx] = el; }}
              onClick={() => setFocusedQIdx(idx)}
              className={`neon-card rounded-2xl p-5 space-y-4 transition-all cursor-default ${
                isMissing    ? 'ring-2 ring-red-400' :
                isFocusedQ   ? 'ring-2 ring-indigo-400' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-slate-800 font-semibold leading-relaxed pt-1">{q.question}</p>
              </div>

              {q.image && (
                <div className="relative group cursor-pointer" onClick={() => setFullscreenImg(q.image)}>
                  <img
                    src={q.image} alt={`صورة السؤال ${idx + 1}`}
                    className="w-full max-h-72 object-contain rounded-xl border border-slate-200 bg-white"
                  />
                  <button className="absolute top-2 left-2 bg-black/40 hover:bg-black/60 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                {ANSWER_LETTERS.map(letter => (
                  <button
                    key={letter} type="button"
                    onClick={() => {
                      const a = [...answers]; a[idx] = letter; setAnswers(a);
                      if (unanswered) setUnanswered(false);
                    }}
                    className={`py-3 rounded-xl border-2 font-bold text-base transition-all min-h-[52px] active:scale-95 ${
                      answers[idx] === letter
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >{letter}</button>
                ))}
              </div>

              {isMissing && <p className="text-red-500 text-xs font-semibold">⚠ الرجاء الإجابة على هذا السؤال</p>}
            </div>
          );
        })}
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-sm border-t border-slate-200 p-4 z-10">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={handleSubmitExam} disabled={submitting}
            className="neon-btn w-full py-4 rounded-xl font-bold text-base disabled:opacity-50"
          >
            {submitting ? 'جاري الإرسال...' : 'تصحيح الامتحان ✓'}
          </button>
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════
     STEP 4-A — Direct Access (no exam)
  ══════════════════════════════════════ */
  if (step === 'access') return (
    <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
      <div className="neon-card p-8 rounded-2xl max-w-md w-full text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">✅ تم فتح الحصة</h2>
          <p className="text-slate-500 text-sm mt-1">{selectedLesson?.title}</p>
        </div>
        <a
          href={`/lessons/${lessonId}`}
          className="neon-btn w-full py-4 rounded-xl font-bold text-base block"
        >
          دخول الحصة →
        </a>
        <button onClick={goNewExam} className="w-full text-slate-400 hover:text-indigo-600 text-sm transition-colors">
          فتح حصة أخرى
        </button>
      </div>
    </div>
  );

  /* ══════════════════════════════════════
     STEP 4-B — Results (after exam)
  ══════════════════════════════════════ */
  const pct    = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = score >= Math.ceil(total / 2);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {FullscreenOverlay}

      <header className="neon-panel border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">{selectedLesson?.title}</p>
            <p className="text-xs text-slate-400">نتيجة الامتحان</p>
          </div>
          <span className={`text-sm font-bold px-3 py-1 rounded-full shrink-0 ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
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
            {passed ? '🎉 أحسنت! لقد اجتزت الامتحان' : '❌ لم تجتز الامتحان — تواصل مع مستر أحمد لفتح الحصة'}
          </p>
          {passed && (
            <a
              href={`/lessons/${lessonId}`}
              className="neon-btn inline-block mt-4 px-8 py-3 rounded-xl font-bold text-base"
            >
              دخول الحصة →
            </a>
          )}
        </div>

        {/* Per-question results */}
        {results.map((r, idx) => (
          <div
            key={idx}
            className={`neon-card rounded-2xl p-5 space-y-4 border-r-4 ${r.isCorrect ? 'border-r-emerald-400' : 'border-r-red-400'}`}
          >
            <div className="flex items-start gap-3">
              <span className={`w-8 h-8 rounded-full font-bold text-sm flex items-center justify-center shrink-0 mt-0.5 ${
                r.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
              }`}>{idx + 1}</span>
              <p className="text-slate-800 font-semibold leading-relaxed pt-1 flex-1">{r.question}</p>
              <div className="shrink-0 mt-0.5">
                {r.isCorrect
                  ? <CheckCircle className="w-6 h-6 text-emerald-500" />
                  : <XCircle className="w-6 h-6 text-red-500" />}
              </div>
            </div>

            {r.image && (
              <div className="relative group cursor-pointer" onClick={() => setFullscreenImg(r.image)}>
                <img
                  src={r.image} alt={`صورة السؤال ${idx + 1}`}
                  className="w-full max-h-80 object-contain rounded-xl border border-slate-200 bg-white"
                />
                <button className="absolute top-2 left-2 bg-black/40 hover:bg-black/60 text-white rounded-lg p-1.5 sm:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className={`flex items-center gap-2 rounded-xl px-4 py-3 font-bold ${
                r.isCorrect ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
              }`}>
                <span className="text-xs text-slate-400 font-normal shrink-0">إجابتك:</span>
                <span>{r.studentAnswer ?? '—'}</span>
                {r.studentAnswer && <span className="text-xs opacity-60">({ANSWER_LABELS[r.studentAnswer] ?? ''})</span>}
              </div>
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span className="text-xs text-slate-400 font-normal shrink-0">الصحيحة:</span>
                <span>{r.correctAnswer}</span>
                <span className="text-xs opacity-60">({ANSWER_LABELS[r.correctAnswer] ?? ''})</span>
              </div>
            </div>
          </div>
        ))}

        <button onClick={goNewExam} className="neon-btn w-full py-4 rounded-xl font-bold text-base mt-4">
          فتح حصة أخرى بكود جديد
        </button>
      </main>
    </div>
  );
}
