import { useState, useEffect, FormEvent } from 'react';
import {
  Video, CheckCircle, Lock, PlayCircle, FileText, ClipboardList,
  Key, X, XCircle, Maximize2,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];
const ANSWER_LABELS: Record<string, string> = { A: 'أ', B: 'ب', C: 'ج', D: 'د' };

interface Question { question: string; image: string | null; }
interface Result {
  question: string; image: string | null;
  studentAnswer: string | null; correctAnswer: string; isCorrect: boolean;
}

type ModalStep = 'code' | 'exam' | 'results' | 'access';
type Section = 'lessons' | 'homework';

export function StudentDashboard() {
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('lessons');
  const [lessons, setLessons] = useState<any[]>([]);
  const [accesses, setAccesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [homeworksLoading, setHomeworksLoading] = useState(true);

  /* ── Modal / flow state ── */
  const [modalLesson, setModalLesson] = useState<any>(null);
  const [modalStep, setModalStep] = useState<ModalStep>('code');

  /* code entry */
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  /* exam */
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [unanswered, setUnanswered] = useState(false);

  /* results */
  const [results, setResults] = useState<Result[]>([]);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);

  /* fullscreen image (inside modal) */
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);


  /* ── Data fetching ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/student/lessons');
        if (res.ok) {
          const data = await res.json();
          setLessons(data.lessons);
          setAccesses(data.accesses);
        } else {
          navigate('/');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/student/homeworks');
        if (res.ok) setHomeworks(await res.json());
      } catch (err) {
        console.error(err);
      } finally {
        setHomeworksLoading(false);
      }
    })();
  }, []);

  const refreshAccesses = async () => {
    try {
      const r = await fetch('/api/student/lessons');
      if (r.ok) { const d = await r.json(); setAccesses(d.accesses); }
    } catch { /* ignore */ }
  };

  /* ── Modal helpers ── */
  const openModal = (lesson: any) => {
    setModalLesson(lesson);
    setModalStep('code');
    setCode(''); setCodeError('');
    setQuestions([]); setAnswers([]);
    setResults([]); setScore(0); setTotal(0);
    setUnanswered(false); setFullscreenImg(null);
  };

  const closeModal = () => { setModalLesson(null); setFullscreenImg(null); };

  /* ── Step 2 → 3 / access: submit code ── */
  const handleCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCodeError(''); setUnlocking(true);
    try {
      const res = await fetch('/api/student/exam/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), lessonId: modalLesson.id }),
      });
      const data = await res.json();
      if (!res.ok) { setCodeError(data.error || 'في مشكلة'); setUnlocking(false); return; }

      if (data.quizExists) {
        setQuestions(data.questions);
        setAnswers(Array(data.questions.length).fill(''));
        setModalStep('exam');
      } else {
        await refreshAccesses();
        setModalStep('access');
      }
    } catch {
      setCodeError('في مشكلة، اتأكد من النت');
    }
    setUnlocking(false);
  };

  /* ── Step 3 → 4: submit exam ── */
  const handleSubmitExam = async () => {
    if (answers.includes('')) {
      setUnanswered(true);
      const idx = answers.indexOf('');
      document.getElementById(`mq-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setUnanswered(false); setSubmitting(true);
    try {
      const res = await fetch('/api/student/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: modalLesson.id, answers }),
      });
      const data = await res.json();
      if (res.ok) {
        setResults(data.results);
        setScore(data.score);
        setTotal(data.total);
        setModalStep('results');
        if (data.score >= Math.ceil(data.total / 2)) await refreshAccesses();
      } else {
        alert(data.error || 'في مشكلة');
      }
    } catch {
      alert('في مشكلة، اتأكد من النت');
    }
    setSubmitting(false);
  };

  const passed = total > 0 ? score >= Math.ceil(total / 2) : false;
  const pct    = total > 0 ? Math.round((score / total) * 100) : 0;

  /* ════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen" dir="rtl">

      {/* ── Top bar ── */}
      <header className="neon-panel border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <img
              src="/logo.png" alt="YouChem"
              className="h-9 sm:h-12 w-auto object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span className="font-bold text-slate-900">
              <span className="neon-text">YouChem</span> Platform
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-5 sm:py-8">

        {/* Welcome */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">أهلاً بيك 👋</h2>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">كمّل رحلتك في التعليم.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 sm:mb-8 border-b border-slate-200 pb-px">
          {([
            { id: 'lessons',  label: 'الحصص',    Icon: Video },
            { id: 'homework', label: 'واجباتي',  Icon: ClipboardList },
          ] as const).map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setSection(id)}
              className={`flex items-center gap-2 px-5 py-3 font-bold text-sm transition-colors border-b-2 -mb-px ${
                section === id
                  ? 'text-indigo-700 border-indigo-600'
                  : 'text-slate-500 border-transparent hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* ── Lessons Grid ── */}
        {section === 'lessons' && (loading ? (
          <div className="text-center p-12 text-slate-400">بيتحمل...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {lessons.map((lesson) => {
              const access     = accesses.find(a => a.lessonId === lesson.id);
              const isUnlocked = !!access;

              const cardInner = (
                <div className="neon-card rounded-2xl overflow-hidden h-full flex flex-col transition-shadow hover:shadow-md">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-slate-100">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Video className="w-10 h-10 text-slate-300 group-hover:text-indigo-400 transition-colors duration-300" />
                    </div>
                    {/* Lock / check badge */}
                    <div className={`absolute top-3 right-3 p-1.5 rounded-lg shadow-sm ${isUnlocked ? 'bg-emerald-500' : 'bg-white border border-slate-200'}`}>
                      {isUnlocked
                        ? <CheckCircle className="w-4 h-4 text-white" />
                        : <Lock className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors mb-3 leading-snug">
                      {lesson.title}
                    </h3>
                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-100">
                      <span className={`text-xs font-semibold ${isUnlocked ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {isUnlocked ? '✓ الحصة متاحة' : 'مقفول — محتاج كود'}
                      </span>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isUnlocked ? 'bg-indigo-50' : 'bg-slate-100'}`}>
                        {isUnlocked
                          ? <PlayCircle className="w-4 h-4 text-indigo-600" />
                          : <Key className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>
                  </div>
                </div>
              );

              return isUnlocked ? (
                <Link to={`/lessons/${lesson.id}`} key={lesson.id} className="block group">
                  {cardInner}
                </Link>
              ) : (
                <button key={lesson.id} onClick={() => openModal(lesson)} className="block group text-right w-full">
                  {cardInner}
                </button>
              );
            })}

            {lessons.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-400 neon-card rounded-2xl">
                مفيش حصص متاحة في صفك دلوقتي.
              </div>
            )}
          </div>
        ))}

        {/* ── Homework Grid ── */}
        {section === 'homework' && (homeworksLoading ? (
          <div className="text-center p-12 text-slate-400">بيتحمل...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {homeworks.map((hw) => (
              <div key={hw.id} className="neon-card rounded-2xl p-5 h-full flex flex-col">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="font-bold text-slate-900 leading-snug pt-1">{hw.title}</h3>
                </div>
                <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-100">
                  {hw.submission ? (
                    <span className="text-sm font-bold text-emerald-600">
                      ✓ درجتك: {hw.submission.score} / {hw.submission.total}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">ما جاوبتش لسه</span>
                  )}
                  <Link to={`/homework/${hw.id}`} className="neon-btn px-4 py-2 rounded-lg text-sm font-bold">
                    {hw.submission ? 'شوف' : 'حل الواجب'}
                  </Link>
                </div>
              </div>
            ))}
            {homeworks.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-400 neon-card rounded-2xl">
                مفيش واجبات متاحة دلوقتي.
              </div>
            )}
          </div>
        ))}
      </main>

      {/* ════════════════════════════════════════════════════
          Modal: Code → Exam → Results / Access
      ════════════════════════════════════════════════════ */}
      {modalLesson && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
          dir="rtl"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          {/* Fullscreen image overlay */}
          {fullscreenImg && (
            <div
              className="absolute inset-0 z-10 bg-black/95 flex items-center justify-center p-4"
              onClick={() => setFullscreenImg(null)}
            >
              <button
                className="absolute top-4 left-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
                onClick={() => setFullscreenImg(null)}
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={fullscreenImg} alt="صورة السؤال"
                className="max-w-full max-h-full object-contain rounded-xl"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}

          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl">

            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
              <div>
                <p className="font-bold text-slate-900 text-sm leading-snug">{modalLesson.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {modalStep === 'code'    ? 'حط كود الوصول'
                  : modalStep === 'exam'   ? 'امتحان القبول'
                  : modalStep === 'results'? 'نتيجة الامتحان'
                  :                          'الحصة اتفتحت'}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="p-5">

              {/* ── STEP: code ── */}
              {modalStep === 'code' && (
                <div className="space-y-5 py-4">
                  <div className="flex justify-center">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                      <Key className="w-7 h-7 text-indigo-600" />
                    </div>
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-slate-900 mb-1">كود الوصول</h2>
                    <p className="text-sm text-slate-500">حط الكود اللي أداهولك مستر أحمد</p>
                  </div>
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
                      type="submit" disabled={unlocking || !code.trim()}
                      className="neon-btn w-full py-4 rounded-xl font-bold text-base disabled:opacity-50"
                    >
                      {unlocking
                        ? <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                            بيتحقق...
                          </span>
                        : 'فعّل الكود'}
                    </button>
                  </form>
                </div>
              )}

              {/* ── STEP: exam ── */}
              {modalStep === 'exam' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-slate-500">جاوب على كل الأسئلة وبعدين اضغط تصحيح</p>
                    <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full shrink-0">
                      {questions.length} سؤال
                    </span>
                  </div>

                  {questions.map((q, idx) => {
                    const isAnswered = answers[idx] !== '';
                    const isMissing  = unanswered && !isAnswered;
                    return (
                      <div
                        id={`mq-${idx}`} key={idx}
                        className={`rounded-2xl p-5 space-y-4 border transition-all ${isMissing ? 'border-red-400 bg-red-50/30' : 'border-slate-200 bg-slate-50'}`}
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

                        {isMissing && (
                          <p className="text-red-500 text-xs font-semibold">⚠ لازم تجاوب على السؤال ده</p>
                        )}
                      </div>
                    );
                  })}

                  <button
                    onClick={handleSubmitExam} disabled={submitting}
                    className="neon-btn w-full py-4 rounded-xl font-bold text-base disabled:opacity-50 mt-2"
                  >
                    {submitting ? 'بيتبعت...' : 'صحّح الامتحان ✓'}
                  </button>
                </div>
              )}

              {/* ── STEP: results ── */}
              {modalStep === 'results' && (
                <div className="space-y-5">
                  {/* Score card */}
                  <div className={`rounded-2xl p-6 text-center border-2 ${passed ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
                    <p className={`text-6xl font-extrabold mb-1 ${passed ? 'text-emerald-600' : 'text-red-500'}`}>
                      {score}<span className="text-3xl font-bold text-slate-400">/{total}</span>
                    </p>
                    <p className="text-slate-500 text-sm mb-3">{pct}%</p>
                    <p className={`font-bold text-base ${passed ? 'text-emerald-700' : 'text-red-600'}`}>
                      {passed
                        ? '🎉 برافو! عدّيت الامتحان'
                        : '❌ ما عدّيتيش الامتحان — كلم مستر أحمد علشان يعفيك'}
                    </p>
                    {passed && (
                      <Link
                        to={`/lessons/${modalLesson.id}`}
                        className="neon-btn inline-block mt-4 px-8 py-3 rounded-xl font-bold text-base"
                      >
                        ادخل الحصة →
                      </Link>
                    )}
                  </div>

                  {/* Per-question results */}
                  {results.map((r, idx) => (
                    <div
                      key={idx}
                      className={`rounded-2xl p-5 space-y-4 border border-slate-200 border-r-4 ${r.isCorrect ? 'border-r-emerald-400' : 'border-r-red-400'}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`w-8 h-8 rounded-full font-bold text-sm flex items-center justify-center shrink-0 mt-0.5 ${r.isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {idx + 1}
                        </span>
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
                        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 font-bold ${r.isCorrect ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                          <span className="text-xs text-slate-400 font-normal shrink-0">إجابتك:</span>
                          <span>{r.studentAnswer ?? '—'}</span>
                          {r.studentAnswer && <span className="text-xs opacity-60">({ANSWER_LABELS[r.studentAnswer] ?? ''})</span>}
                        </div>
                        <div className="flex items-center gap-2 rounded-xl px-4 py-3 font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          <span className="text-xs text-slate-400 font-normal shrink-0">الصح:</span>
                          <span>{r.correctAnswer}</span>
                          <span className="text-xs opacity-60">({ANSWER_LABELS[r.correctAnswer] ?? ''})</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={closeModal}
                    className="w-full py-3 rounded-xl font-bold text-sm text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    ارجع للداشبورد
                  </button>
                </div>
              )}

              {/* ── STEP: access (no exam) ── */}
              {modalStep === 'access' && (
                <div className="py-8 text-center space-y-5">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">✅ الحصة اتفتحت</h2>
                    <p className="text-slate-500 text-sm mt-1">{modalLesson.title}</p>
                  </div>
                  <Link
                    to={`/lessons/${modalLesson.id}`}
                    className="neon-btn w-full py-4 rounded-xl font-bold text-base block"
                  >
                    ادخل الحصة →
                  </Link>
                  <button onClick={closeModal} className="w-full text-slate-400 hover:text-indigo-600 text-sm transition-colors">
                    ارجع للداشبورد
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
