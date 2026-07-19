import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Key, CheckCircle, XCircle, FileText, Download } from 'lucide-react';

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

  const [homework, setHomework] = useState<any>(null);
  const [homeworkLoading, setHomeworkLoading] = useState(false);
  const [homeworkAnswers, setHomeworkAnswers] = useState<string[]>([]);
  const [submittingHomework, setSubmittingHomework] = useState(false);
  const [homeworkResult, setHomeworkResult] = useState<any>(null);

  useEffect(() => {
    fetchLessonData();
    fetchHomework();
  }, [id]);

  useEffect(() => {
    if (lesson && access && !access.quizPassed && !access.quizExempt) fetchQuiz();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, access]);

  const fetchHomework = async () => {
    setHomeworkLoading(true);
    try {
      const res = await fetch(`/api/student/homework/${id}`);
      if (res.ok) {
        const data = await res.json();
        setHomework(data.homework);
        if (data.homework) setHomeworkAnswers(Array(data.homework.numQuestions).fill(''));
        if (data.pastResult) setHomeworkResult(data.pastResult);
      }
    } catch (err) { console.error(err); }
    setHomeworkLoading(false);
  };

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
      else { setCodeError(data.error || 'كود غير صحيح'); }
    } catch { setCodeError('حدث خطأ'); }
    setValidatingCode(false);
  };

  const handleSubmitQuiz = async () => {
    if (answers.includes('')) return alert('الرجاء الإجابة على جميع الأسئلة');
    setSubmittingQuiz(true);
    try {
      const res = await fetch('/api/student/submit-quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: lesson.id, answers }) });
      const data = await res.json();
      if (res.ok) { setQuizResult(data); fetchLessonData(); }
    } catch { alert('خطأ'); }
    setSubmittingQuiz(false);
  };

  const handleSubmitHomework = async () => {
    if (homeworkAnswers.includes('')) return alert('الرجاء الإجابة على جميع الأسئلة');
    setSubmittingHomework(true);
    try {
      const res = await fetch('/api/student/submit-homework', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonId: id, answers: homeworkAnswers }) });
      const data = await res.json();
      if (res.ok) { setHomeworkResult(data); }
      else { alert(data.error || 'حدث خطأ'); }
    } catch { alert('خطأ'); }
    setSubmittingHomework(false);
  };

  if (loading || !lesson) return (
    <div className="min-h-screen flex items-center justify-center text-slate-400">جاري التحميل...</div>
  );

  const isVideoUnlocked = access?.quizPassed || access?.quizExempt || noQuizExists;
  const needsCode = !access;
  const needsQuiz = access && !access.quizPassed && !access.quizExempt && !noQuizExists;

  const extractYoutubeId = (url: string) => {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
    return m ? m[1] : url;
  };

  return (
    <div className="min-h-screen" dir="rtl">

      {/* ── Navbar ── */}
      <header className="neon-panel border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/student-dashboard')} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-slate-900 line-clamp-1 text-sm leading-tight">{lesson.title}</h1>
            <p className="text-xs text-slate-400 uppercase tracking-wider">{lesson.platform}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

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
              /* Code was accepted — still checking if quiz is required */
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-slate-50 to-slate-100">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">✅ تم فتح الدرس</h3>
                <p className="text-slate-500 max-w-sm text-sm">جاري التحضير...</p>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-slate-50 to-slate-100">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${access ? 'bg-amber-50 border border-amber-200' : 'bg-indigo-50 border border-indigo-100'}`}>
                  {access
                    ? <CheckCircle className="w-8 h-8 text-amber-500" />
                    : <Lock className="w-8 h-8 text-indigo-400" />}
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">
                  {access ? '✅ الدرس مفتوح — أكمل الاختبار' : 'المحتوى مغلق'}
                </h3>
                <p className="text-slate-500 max-w-sm text-sm">
                  {needsCode
                    ? 'أدخل كود الوصول الخاص بك لمشاهدة هذا الدرس.'
                    : 'اجتز الاختبار أدناه لفتح الفيديو.'}
                </p>
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
            <p className="text-slate-500 text-sm mb-6">أدخل الكود الذي حصلت عليه من مستر أحمد لفتح هذا الدرس.</p>
            <form onSubmit={handleValidateCode} className="space-y-3">
              <input
                type="text" required placeholder="YCH-XXXXXX"
                value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="neon-input w-full px-4 py-3 rounded-xl text-center font-mono text-xl uppercase tracking-widest"
                dir="ltr"
              />
              {codeError && <p className="text-red-500 text-sm font-semibold">{codeError}</p>}
              <button type="submit" disabled={validatingCode} className="neon-btn w-full px-4 py-3 rounded-xl font-bold disabled:opacity-50">
                {validatingCode ? 'جاري التحقق...' : 'تفعيل الكود'}
              </button>
            </form>
          </div>
        )}

        {/* ── Quiz ── */}
        {needsQuiz && (
          <div className="neon-card p-6 md:p-8 rounded-2xl">
            <div className="mb-6 pb-5 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">اختبار الدرس</h2>
              <p className="text-slate-500 text-sm mt-1">يجب اجتياز الاختبار لفتح الفيديو.</p>
            </div>

            {quizResult ? (
              <div className="space-y-6">
                <div className={`p-6 rounded-2xl border text-center ${quizResult.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-slate-600 text-sm mb-1">درجتك في الاختبار</p>
                  <p className={`text-5xl font-extrabold ${quizResult.passed ? 'text-emerald-600' : 'text-red-500'}`}>
                    {quizResult.score} / {quizResult.total}
                  </p>
                  <p className="text-slate-500 mt-1">({Math.round((quizResult.score / quizResult.total) * 100)}%)</p>
                  <p className={`mt-3 font-bold ${quizResult.passed ? 'text-emerald-700' : 'text-red-600'}`}>
                    {quizResult.passed ? '🎉 مبروك! لقد اجتزت الاختبار وتم فتح الفيديو.' : 'لم تجتز الاختبار بعد.'}
                  </p>
                  {!quizResult.passed && (
                    <button onClick={() => { setQuizResult(null); setAnswers([]); fetchQuiz(); }} className="neon-btn mt-4 px-6 py-2.5 rounded-xl font-bold">
                      إعادة المحاولة
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {(quizResult.results || []).map((r: any, idx: number) => (
                    <div key={idx} className={`p-4 rounded-xl border space-y-1 ${r.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center gap-2">
                        {r.isCorrect ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                        <span className="font-bold text-slate-800 text-sm">سؤال {idx + 1}</span>
                      </div>
                      {!r.isCorrect && <p className="text-red-600 text-xs">إجابتك: {r.studentAnswer || 'لم تجب'}</p>}
                      <p className="text-emerald-700 text-xs font-semibold">الصحيحة: {r.correctAnswer}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : quizLoading ? (
              <div className="text-center p-8 text-slate-400">جاري تحميل الاختبار...</div>
            ) : quizQuestions.length === 0 ? (
              <div className="text-center p-8 text-slate-400">لم يتم إضافة اختبار لهذا الدرس بعد.</div>
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
                      <div className="flex gap-2">
                        {ANSWER_LETTERS.map((letter) => (
                          <button
                            key={letter} type="button"
                            onClick={() => { const a = [...answers]; a[idx] = letter; setAnswers(a); }}
                            className={`flex-1 py-3 rounded-xl border-2 font-bold text-base transition-all ${
                              answers[idx] === letter
                                ? 'bg-indigo-600 border-indigo-600 text-white neon-glow-ring'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                            }`}
                          >{letter}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-6 border-t border-slate-200 flex justify-end">
                  <button onClick={handleSubmitQuiz} disabled={submittingQuiz} className="neon-btn w-full md:w-auto px-8 py-3 rounded-xl font-bold disabled:opacity-50">
                    {submittingQuiz ? 'جاري الإرسال...' : 'تسليم الاختبار'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Homework ── */}
        {!homeworkLoading && homework && (
          <div className="neon-card p-6 md:p-8 rounded-2xl">
            <div className="mb-6 pb-5 border-b border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">واجب الدرس</h2>
                <p className="text-slate-500 text-sm mt-0.5">حمّل الواجب، حله، ثم سجل إجاباتك هنا للتصحيح.</p>
              </div>
            </div>

            <a href={homework.pdfUrl} target="_blank" rel="noreferrer" className="neon-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold mb-6">
              <Download className="w-4 h-4" />
              تحميل ملف الواجب (PDF)
            </a>

            {homeworkResult ? (
              <div className="space-y-5">
                <div className="p-6 rounded-2xl border bg-indigo-50 border-indigo-200 text-center">
                  <p className="text-slate-600 text-sm mb-1">درجتك في الواجب</p>
                  <p className="text-5xl font-extrabold text-indigo-700">{homeworkResult.score} / {homeworkResult.total}</p>
                  <p className="text-slate-500 mt-1">({Math.round((homeworkResult.score / homeworkResult.total) * 100)}%)</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {(homeworkResult.results || []).map((r: any) => (
                    <div key={r.questionNumber} className={`p-4 rounded-xl border space-y-1 ${r.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center gap-2">
                        {r.isCorrect ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                        <span className="font-bold text-slate-800 text-sm">سؤال {r.questionNumber}</span>
                      </div>
                      {!r.isCorrect && <p className="text-red-600 text-xs">إجابتك: {r.studentAnswer || 'لم تجب'}</p>}
                      <p className="text-emerald-700 text-xs font-semibold">الصحيحة: {r.correctAnswer}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {Array.from({ length: homework.numQuestions }).map((_, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <span className="text-xs font-bold text-slate-500">سؤال {idx + 1}</span>
                      <div className="flex gap-1">
                        {ANSWER_LETTERS.map((letter) => (
                          <button
                            type="button" key={letter}
                            onClick={() => { const a = [...homeworkAnswers]; a[idx] = letter; setHomeworkAnswers(a); }}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              homeworkAnswers[idx] === letter ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
                            }`}
                          >{letter}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-6 border-t border-slate-200 flex justify-end">
                  <button onClick={handleSubmitHomework} disabled={submittingHomework} className="neon-btn w-full md:w-auto px-8 py-3 rounded-xl font-bold disabled:opacity-50">
                    {submittingHomework ? 'جاري التصحيح...' : 'تصحيح'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
