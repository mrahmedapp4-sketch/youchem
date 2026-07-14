import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Key, CheckCircle, XCircle, Video, FileText, Download } from 'lucide-react';

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

export function LessonView() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [lesson, setLesson] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Code Validation State
  const [code, setCode] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);
  const [codeError, setCodeError] = useState('');

  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<any>(null);

  // Homework State
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
    const shouldFetchQuiz = lesson && lesson.platform === 'vimeo' && access && !access.quizPassed && !access.quizExempt;
    if (shouldFetchQuiz) {
      fetchQuiz();
    }
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
      }
    } catch (err) {
      console.error(err);
    }
    setHomeworkLoading(false);
  };

  const handleHomeworkOptionSelect = (qIndex: number, letter: string) => {
    const next = [...homeworkAnswers];
    next[qIndex] = letter;
    setHomeworkAnswers(next);
  };

  const handleSubmitHomework = async () => {
    if (homeworkAnswers.includes('')) return alert('الرجاء الإجابة على جميع الأسئلة');
    setSubmittingHomework(true);
    try {
      const res = await fetch('/api/student/submit-homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: id, answers: homeworkAnswers }),
      });
      const data = await res.json();
      if (res.ok) {
        setHomeworkResult(data);
      } else {
        alert(data.error || 'حدث خطأ');
      }
    } catch (err) {
      alert('خطأ');
    }
    setSubmittingHomework(false);
  };

  const fetchQuiz = async () => {
    setQuizLoading(true);
    try {
      const res = await fetch(`/api/student/quiz/${lesson.id}`);
      if (res.ok) {
        const data = await res.json();
        const qs = data.questions || [];
        setQuizQuestions(qs);
        setAnswers(Array(qs.length).fill(''));
      }
    } catch (err) {
      console.error(err);
    }
    setQuizLoading(false);
  };

  const fetchLessonData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/student/lessons');
      if (res.ok) {
        const data = await res.json();
        const foundLesson = data.lessons.find((l: any) => l.id === id);
        if (!foundLesson) {
          navigate('/student-dashboard');
          return;
        }
        setLesson(foundLesson);
        setAccess(data.accesses.find((a: any) => a.lessonId === id));
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidatingCode(true);
    setCodeError('');
    try {
      // SERVER ACTION: Validate Code
      const res = await fetch('/api/student/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: lesson.id, code })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Refresh to get access record
        fetchLessonData();
      } else {
        setCodeError(data.error || 'كود غير صحيح');
      }
    } catch (err) {
      setCodeError('حدث خطأ');
    }
    setValidatingCode(false);
  };

  const handleOptionSelect = (qIndex: number, option: string) => {
    const newAnswers = [...answers];
    newAnswers[qIndex] = option;
    setAnswers(newAnswers);
  };

  const handleSubmitQuiz = async () => {
    if (answers.includes('')) return alert('الرجاء الإجابة على جميع الأسئلة');
    setSubmittingQuiz(true);
    try {
      // SERVER ACTION: Submit Quiz
      const res = await fetch('/api/student/submit-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: lesson.id, answers })
      });
      const data = await res.json();
      if (res.ok) {
        setQuizResult(data);
        fetchLessonData();
      }
    } catch (err) {
      alert('خطأ');
    }
    setSubmittingQuiz(false);
  };

  if (loading || !lesson) {
    return <div className="min-h-screen flex items-center justify-center p-8 text-slate-400">جاري التحميل...</div>;
  }

  const isVideoUnlocked = lesson.isFree || access?.quizPassed || access?.quizExempt;
  const needsCode = lesson.platform === 'vimeo' && !access;
  const needsQuiz = lesson.platform === 'vimeo' && access && !access.quizPassed && !access.quizExempt;

  const extractYoutubeId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
    return match ? match[1] : url;
  };

  return (
    <div className="min-h-screen" dir="rtl">
      {/* Navbar */}
      <header className="neon-panel border-b">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={() => navigate('/student-dashboard')} className="p-2 text-slate-400 hover:text-cyan-300 hover:bg-white/5 rounded-lg transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-white line-clamp-1">{lesson.title}</h1>
            <p className="text-xs text-slate-400">{lesson.platform === 'youtube' ? 'متاح مجاناً' : 'محتوى حصري'}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        
        {/* VIDEO PLAYER SECTION */}
        <div className="neon-card rounded-2xl overflow-hidden">
          <div className="aspect-video bg-black relative">
            {isVideoUnlocked ? (
              lesson.platform === 'youtube' ? (
                <iframe src={`https://www.youtube.com/embed/${extractYoutubeId(lesson.videoUrl)}`} className="absolute inset-0 w-full h-full" allowFullScreen />
              ) : (
                <iframe src={`https://player.vimeo.com/video/${lesson.videoUrl}?dnt=1`} className="absolute inset-0 w-full h-full" allowFullScreen />
              )
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-slate-900 to-black">
                <Lock className="w-16 h-16 text-cyan-400/70 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">المحتوى مغلق</h3>
                <p className="text-slate-400 max-w-sm">
                  {needsCode ? 'يرجى إدخال كود الوصول الخاص بك لمشاهدة هذا الدرس.' : 'يجب عليك اجتياز الاختبار أولاً لفتح هذا الدرس.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ACCESS LOGIC SECTIONS */}
        {needsCode && (
          <div className="neon-card p-8 rounded-2xl max-w-md mx-auto">
            <div className="w-12 h-12 bg-cyan-400/10 text-cyan-300 rounded-xl flex items-center justify-center mb-6 border border-cyan-400/20">
              <Key className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">كود الوصول</h2>
            <p className="text-slate-400 mb-6">أدخل الكود الذي حصلت عليه من مستر أحمد لفتح هذا الدرس.</p>
            
            <form onSubmit={handleValidateCode} className="space-y-4">
              <div>
                <input 
                  type="text" 
                  required
                  placeholder="YCH-XXXXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="neon-input w-full px-4 py-3 rounded-xl text-center font-mono text-xl uppercase tracking-widest"
                  dir="ltr"
                />
                {codeError && <p className="text-red-400 text-sm mt-2 font-semibold">{codeError}</p>}
              </div>
              <button 
                type="submit" 
                disabled={validatingCode}
                className="neon-btn w-full px-4 py-3 rounded-xl font-bold disabled:opacity-50"
              >
                {validatingCode ? 'جاري التحقق...' : 'تفعيل الكود'}
              </button>
            </form>
          </div>
        )}

        {needsQuiz && (
          <div className="neon-card p-6 md:p-8 rounded-2xl">
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-cyan-500/10">
              <div>
                <h2 className="text-2xl font-bold text-white">اختبار الدرس</h2>
                <p className="text-slate-400 mt-1">يجب اجتياز الاختبار (5 من 10) لفتح الفيديو.</p>
              </div>
            </div>

            {quizResult ? (
              <div className="space-y-6">
                <div className={`p-6 rounded-xl border text-center ${quizResult.passed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <p className="text-slate-300 mb-1">درجتك في الاختبار</p>
                  <p className={`text-4xl font-extrabold ${quizResult.passed ? 'text-emerald-300' : 'text-red-300'}`}>
                    {quizResult.score} / {quizResult.total}
                  </p>
                  <p className="text-lg font-bold text-slate-300 mt-1">
                    ({Math.round((quizResult.score / quizResult.total) * 100)}%)
                  </p>
                  <p className="mt-2 font-semibold text-slate-200">
                    {quizResult.passed ? 'مبروك! لقد اجتزت الاختبار وتم فتح الفيديو.' : 'لم تجتز الاختبار بعد.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {(quizResult.results || []).map((r: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border space-y-1 ${r.isCorrect ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}
                    >
                      <div className="flex items-center gap-2">
                        {r.isCorrect ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        )}
                        <span className="font-bold text-white">سؤال {idx + 1}</span>
                      </div>
                      {!r.isCorrect && <p className="text-red-300 text-sm">إجابتك: {r.studentAnswer || 'لم تجب'}</p>}
                      <p className="text-emerald-300 text-sm">الإجابة الصحيحة: {r.correctAnswer}</p>
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
                <div className="space-y-8">
                  {quizQuestions.map((q, idx) => (
                    <div key={idx} className="space-y-4 p-6 bg-black/20 rounded-xl border border-cyan-500/10">
                      <h3 className="font-bold text-white text-lg">السؤال رقم {idx + 1}</h3>
                      <p className="text-slate-300">{q.question}</p>
                      {q.image && (
                        <div className="w-full max-w-xl mx-auto aspect-video bg-black/30 rounded-xl overflow-hidden border border-cyan-500/10">
                          <img src={q.image} alt={`صورة السؤال ${idx + 1}`} className="w-full h-full object-contain" />
                        </div>
                      )}
                      <div className="flex gap-3 mt-4">
                        {ANSWER_LETTERS.map((letter) => (
                          <button
                            key={letter}
                            type="button"
                            onClick={() => handleOptionSelect(idx, letter)}
                            className={`flex-1 py-4 rounded-xl border-2 font-bold text-lg transition-all ${answers[idx] === letter ? 'bg-cyan-400/10 border-cyan-400 text-cyan-300 neon-glow-ring' : 'bg-white/5 border-slate-700 text-slate-200 hover:border-cyan-500/40'}`}
                          >
                            {letter}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-8 pt-8 border-t border-cyan-500/10 flex justify-end">
                  <button 
                    onClick={handleSubmitQuiz}
                    disabled={submittingQuiz}
                    className="neon-btn w-full md:w-auto px-8 py-3 rounded-xl font-bold disabled:opacity-50"
                  >
                    {submittingQuiz ? 'جاري الإرسال...' : 'تسليم الاختبار'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* HOMEWORK SECTION */}
        {homeworkLoading ? null : homework && (
          <div className="neon-card p-6 md:p-8 rounded-2xl">
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-cyan-500/10">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <FileText className="w-6 h-6 text-cyan-300" />
                  واجب الدرس
                </h2>
                <p className="text-slate-400 mt-1">حمّل ملف الواجب، حله، ثم سجل إجاباتك هنا للتصحيح.</p>
              </div>
            </div>

            <a
              href={homework.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="neon-btn inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold mb-8"
            >
              <Download className="w-5 h-5" />
              تحميل ملف الواجب (PDF)
            </a>

            {homeworkResult ? (
              <div className="space-y-6">
                <div className="p-6 rounded-xl border bg-cyan-400/10 border-cyan-400/30 text-center">
                  <p className="text-slate-300 mb-1">درجتك في الواجب</p>
                  <p className="text-4xl font-extrabold text-cyan-300">
                    {homeworkResult.score} / {homeworkResult.total}
                  </p>
                  <p className="text-lg font-bold text-slate-300 mt-1">
                    ({Math.round((homeworkResult.score / homeworkResult.total) * 100)}%)
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {(homeworkResult.results || []).map((r: any) => (
                    <div
                      key={r.questionNumber}
                      className={`p-4 rounded-xl border space-y-1 ${r.isCorrect ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}
                    >
                      <div className="flex items-center gap-2">
                        {r.isCorrect ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        )}
                        <span className="font-bold text-white">سؤال {r.questionNumber}</span>
                      </div>
                      {!r.isCorrect && <p className="text-red-300 text-sm">إجابتك: {r.studentAnswer || 'لم تجب'}</p>}
                      <p className="text-emerald-300 text-sm">الإجابة الصحيحة: {r.correctAnswer}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {Array.from({ length: homework.numQuestions }).map((_, idx) => (
                    <div key={idx} className="p-3 bg-black/20 rounded-xl border border-cyan-500/10 space-y-2">
                      <span className="text-xs font-bold text-slate-400">سؤال {idx + 1}</span>
                      <div className="flex gap-1">
                        {ANSWER_LETTERS.map((letter) => (
                          <button
                            type="button"
                            key={letter}
                            onClick={() => handleHomeworkOptionSelect(idx, letter)}
                            className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                              homeworkAnswers[idx] === letter ? 'bg-cyan-400 text-black' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            {letter}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-8 border-t border-cyan-500/10 flex justify-end">
                  <button
                    onClick={handleSubmitHomework}
                    disabled={submittingHomework}
                    className="neon-btn w-full md:w-auto px-8 py-3 rounded-xl font-bold disabled:opacity-50"
                  >
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
