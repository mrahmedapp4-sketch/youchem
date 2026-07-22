import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Key, CheckCircle, XCircle, RefreshCw, X } from 'lucide-react';

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

export function LessonView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);
  const [codeError, setCodeError] = useState('');

  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [noQuizExists, setNoQuizExists] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<any>(null);

  // When true, student dismissed the quiz with X — video stays accessible (unless locked)
  const [quizDismissed, setQuizDismissed] = useState(false);

  // ── Viewing-time heartbeat ────────────────────────────────────────────────
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accessRef = useRef<any>(null);
  accessRef.current = access;

  useEffect(() => {
    if (!id) return;
    heartbeatRef.current = setInterval(() => {
      const currentAccess = accessRef.current;
      if (!currentAccess) return;
      fetch('/api/student/lesson-heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: id }),
      }).catch(() => {/* ignore network errors */});
    }, 60_000);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [id]);

  useEffect(() => {
    fetchLessonData();
  }, [id]);

  useEffect(() => {
    if (lesson && access && !access.quizPassed && !access.quizExempt) fetchQuiz();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, access]);

  const fetchQuiz = async () => {
    setQuizLoading(true);
    try {
      const res = await fetch(`/api/student/quiz/${lesson.id}`);
      if (res.ok) {
        const data = await res.json();
        const qs = data.questions || [];
        if (qs.length === 0) {
          setNoQuizExists(true);
        } else {
          setQuizQuestions(qs);
          setAnswers(Array(qs.length).fill(''));
        }
      }
    } catch (err) { console.error(err); }
    setQuizLoading(false);
  };

  const fetchLessonData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/student/lessons');
      if (res.ok) {
        const data = await res.json();
        const foundLesson = data.lessons.find((l: any) => l.id === id);
        if (!foundLesson) { navigate('/student-dashboard'); return; }
        setLesson(foundLesson);
        const foundAccess = data.accesses.find((a: any) => a.lessonId === id);
        setAccess(foundAccess);
        if (foundAccess?.quizScore !== undefined) {
          setQuizResult({ score: foundAccess.quizScore, total: foundAccess.quizTotal, passed: foundAccess.quizPassed, results: foundAccess.quizResults || [] });
        }
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidatingCode(true);
    setCodeError('');
    try {
      const res = await fetch('/api/student/validate-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: lesson.id, code }) });
      const data = await res.json();
      if (res.ok && data.success) { fetchLessonData(); }
      else { setCodeError(data.error || 'الكود غلط'); }
    } catch { setCodeError('في مشكلة'); }
    setValidatingCode(false);
  };

  const handleSubmitQuiz = async () => {
    if (answers.includes('')) return alert('لازم تجاوب على كل الأسئلة');
    setSubmittingQuiz(true);
    try {
      const res = await fetch('/api/student/submit-quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: lesson.id, answers }) });
      const data = await res.json();
      if (res.ok) { setQuizResult(data); fetchLessonData(); }
    } catch { alert('في مشكلة'); }
    setSubmittingQuiz(false);
  };

  const handleRetakeQuiz = () => {
    setQuizResult(null);
    setAnswers([]);
    setQuizDismissed(false);
    fetchQuiz();
  };

  const handleDismissQuiz = () => {
    setQuizDismissed(true);
  };

  if (loading || !lesson) return (
    <div className="min-h-screen flex items-center justify-center text-slate-400">بيتحمل...</div>
  );

  // ── Derived state ──────────────────────────────────────────────────────────
  // Code entry unlocks the lesson immediately. The only exception is when the
  // student already submitted the quiz and scored < 5/10 (lessonLocked=true),
  // in which case the lesson is re-locked until the teacher exempts them OR
  // they retake and pass.
  const isLessonLocked = access?.lessonLocked && !access?.quizExempt;
  const isVideoUnlocked = access && !isLessonLocked;
  const needsCode = !access;

  // Show quiz section when: has code, not yet passed, not exempt, quiz exists,
  // AND (lesson is locked — must show for retake — OR quiz not dismissed yet)
  const showQuizSection =
    access &&
    !access.quizPassed &&
    !access.quizExempt &&
    !noQuizExists &&
    (isLessonLocked || !quizDismissed);

  const extractYoutubeId = (url: string) => {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
    return m ? m[1] : url;
  };

  return (
    <div className="min-h-screen" dir="rtl">

      {/* ── Navbar ── */}
      <header className="neon-panel border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-3">
          <button onClick={() => navigate('/student-dashboard')} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-slate-900 line-clamp-1 text-sm leading-tight">{lesson.title}</h1>
            <p className="text-xs text-slate-400 uppercase tracking-wider">{lesson.platform}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5 sm:space-y-6">

        {/* ── Video ── */}
        <div className="neon-card rounded-2xl overflow-hidden">
          <div className="aspect-video bg-slate-100 relative">
            {isVideoUnlocked ? (
              lesson.platform === 'youtube'
                ? <iframe src={`https://www.youtube.com/embed/${extractYoutubeId(lesson.videoUrl)}`} className="absolute inset-0 w-full h-full" allowFullScreen />
                : lesson.platform === 'bunny'
                ? <iframe src={lesson.videoUrl.replace('player.mediadelivery.net/play/', 'iframe.mediadelivery.net/embed/')} className="absolute inset-0 w-full h-full" allowFullScreen allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" />
                : <iframe src={`https://player.vimeo.com/video/${lesson.videoUrl}?dnt=1`} className="absolute inset-0 w-full h-full" allowFullScreen />
            ) : quizLoading && access ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-slate-50 to-slate-100">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">✅ الدرس اتفتح</h3>
                <p className="text-slate-500 max-w-sm text-sm">بيتجهز...</p>
              </div>
            ) : isLessonLocked ? (
              /* Locked because student failed the quiz (< 5/10) */
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-red-50 to-slate-100">
                <div className="w-16 h-16 rounded-full bg-red-100 border border-red-200 flex items-center justify-center mb-4">
                  <Lock className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">🔒 الحصة مقفولة</h3>
                <p className="text-slate-500 max-w-sm text-sm">
                  جبت {access.quizScore}/{access.quizTotal} في الامتحان. اعمل إعادة الامتحان من تحت أو كلم مستر أحمد علشان يفتحهالك.
                </p>
              </div>
            ) : (
              /* Needs code */
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-slate-50 to-slate-100">
                <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4">
                  <Lock className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">المحتوى مقفول</h3>
                <p className="text-slate-500 max-w-sm text-sm">حط الكود اللي معاك علشان تشوف الدرس.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Code entry ── */}
        {needsCode && (
          <div className="neon-card p-8 rounded-2xl max-w-md mx-auto text-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-5">
              <Key className="w-6 h-6 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">كود الوصول</h2>
            <p className="text-slate-500 text-sm mb-6">حط الكود اللي أخدته من مستر أحمد علشان تفتح الدرس.</p>
            <form onSubmit={handleValidateCode} className="space-y-3">
              <input
                type="text" required placeholder="YCH-XXXXXX"
                value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="neon-input w-full px-4 py-3 rounded-xl text-center font-mono text-xl uppercase tracking-widest"
                dir="ltr"
              />
              {codeError && <p className="text-red-500 text-sm font-semibold">{codeError}</p>}
              <button type="submit" disabled={validatingCode} className="neon-btn w-full px-4 py-3 rounded-xl font-bold disabled:opacity-50">
                {validatingCode ? 'بيتحقق...' : 'فعّل الكود'}
              </button>
            </form>
          </div>
        )}

        {/* ── Quiz ── */}
        {showQuizSection && (
          <div className="neon-card p-4 sm:p-6 md:p-8 rounded-2xl">
            <div className="mb-5 pb-4 sm:mb-6 sm:pb-5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">امتحان الدرس</h2>
                <p className="text-slate-500 text-sm mt-0.5">
                  {isLessonLocked
                    ? 'الحصة مقفولة — اعمل إعادة الامتحان وجيب ٥/١٠ أو أكتر علشان تفتحها.'
                    : 'خد الامتحان علشان تثبت إنك فاهم الدرس.'}
                </p>
              </div>
              {/* X button — only shown when lesson is NOT locked (dismissing is allowed) */}
              {!isLessonLocked && (
                <button
                  onClick={handleDismissQuiz}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                  title="تخطي الامتحان (الحصة تفضل مفتوحة)"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {quizResult ? (
              <div className="space-y-6">
                <div className={`p-6 rounded-2xl border text-center ${quizResult.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-slate-600 text-sm mb-1">درجتك في الامتحان</p>
                  <p className={`text-5xl font-extrabold ${quizResult.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                    {quizResult.score} / {quizResult.total}
                  </p>
                  <p className="text-slate-500 mt-1">({Math.round((quizResult.score / quizResult.total) * 100)}%)</p>
                  <p className={`mt-3 font-bold ${quizResult.passed ? 'text-emerald-700' : 'text-red-600'}`}>
                    {quizResult.passed ? '🎉 مبروك! عدّيت الامتحان والفيديو اتفتح.' : '❌ لم تجتز الامتحان.'}
                  </p>

                  {!quizResult.passed && (
                    <div className="mt-4 space-y-3">
                      {/* Locked notice */}
                      <p className="text-sm font-semibold text-red-700 bg-red-100 border border-red-200 rounded-xl px-4 py-3">
                        🔒 الحصة مقفولة — كلم مستر أحمد علشان يفتحهالك، أو اعمل إعادة الامتحان
                      </p>
                      {/* Retake button */}
                      <button
                        onClick={handleRetakeQuiz}
                        className="inline-flex items-center gap-2 neon-btn px-6 py-2.5 rounded-xl font-bold"
                      >
                        <RefreshCw className="w-4 h-4" />
                        إعادة الامتحان
                      </button>
                    </div>
                  )}
                </div>

                {/* Per-question breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {(quizResult.results || []).map((r: any, idx: number) => (
                    <div key={idx} className={`p-4 rounded-xl border space-y-1 ${r.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center gap-2">
                        {r.isCorrect ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                        <span className="font-bold text-slate-800 text-sm">سؤال {idx + 1}</span>
                      </div>
                      {!r.isCorrect && <p className="text-red-600 text-xs">إجابتك: {r.studentAnswer || 'ما جبتيش'}</p>}
                      <p className="text-emerald-700 text-xs font-semibold">الصح: {r.correctAnswer}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : quizLoading ? (
              <div className="text-center p-8 text-slate-400">بيتحمل الامتحان...</div>
            ) : quizQuestions.length === 0 ? (
              <div className="text-center p-8 text-slate-400">مفيش امتحان للدرس ده لسه.</div>
            ) : (
              <>
                <div className="space-y-6">
                  {quizQuestions.map((q, idx) => (
                    <div key={idx} className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                        <p className="text-slate-800 font-semibold">{q.question}</p>
                      </div>
                      {q.image && (
                        <div className="w-full max-w-xl mx-auto aspect-video bg-white rounded-xl overflow-hidden border border-slate-200">
                          <img src={q.image} alt={`صورة السؤال ${idx + 1}`} className="w-full h-full object-contain" />
                        </div>
                      )}
                      <div className="grid grid-cols-4 gap-2">
                        {ANSWER_LETTERS.map((letter) => (
                          <button
                            key={letter} type="button"
                            onClick={() => { const a = [...answers]; a[idx] = letter; setAnswers(a); }}
                            className={`py-3.5 rounded-xl border-2 font-bold text-base transition-all min-h-[52px] active:scale-95 ${
                              answers[idx] === letter
                                ? 'bg-indigo-600 border-indigo-600 text-white neon-glow-ring'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 active:bg-indigo-50'
                            }`}
                          >{letter}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-6 border-t border-slate-200 flex gap-3">
                  <button onClick={handleSubmitQuiz} disabled={submittingQuiz} className="neon-btn flex-1 py-4 rounded-xl font-bold text-base disabled:opacity-50">
                    {submittingQuiz ? 'بيتبعت...' : 'سلّم الامتحان'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Quiz dismissed notice ── */}
        {access && quizDismissed && !isLessonLocked && !access.quizPassed && !access.quizExempt && !noQuizExists && (
          <div className="neon-card p-4 rounded-2xl flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">تخطيت الامتحان — الحصة مفتوحة. ممكن ترجعله في أي وقت.</p>
            <button
              onClick={() => setQuizDismissed(false)}
              className="text-sm font-bold text-indigo-600 hover:underline shrink-0 flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              خد الامتحان
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
