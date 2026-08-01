import { useState, useEffect, FormEvent } from 'react';
import {
  Video, CheckCircle, Lock, PlayCircle, FileText, ClipboardList,
  Key, X, XCircle, Maximize2, Sun, Moon, Trophy, Medal, Award, Languages,
  Menu, Folder, Download, LogOut,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../context/LanguageContext';
import { tr } from '../lib/translations';

const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];
const ANSWER_LABELS: Record<string, string> = { A: 'أ', B: 'ب', C: 'ج', D: 'د' };

interface Question { question: string; image: string | null; }
interface Result {
  question: string; image: string | null;
  studentAnswer: string | null; correctAnswer: string; isCorrect: boolean;
}

type ModalStep = 'code' | 'exam' | 'results' | 'access';
type Section = 'lessons' | 'homework' | 'files' | 'leaderboard';

export function StudentDashboard() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang } = useLang();
  const [section, setSection] = useState<Section>('lessons');
  const [lessons, setLessons] = useState<any[]>([]);
  const [accesses, setAccesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [homeworksLoading, setHomeworksLoading] = useState(true);

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const [studentFiles, setStudentFiles] = useState<any[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  const fetchLeaderboard = async () => {
    setLeaderboardLoading(true);
    try {
      const r = await fetch('/api/student/leaderboard');
      if (r.ok) setLeaderboard(await r.json());
    } catch { /* ignore */ }
    setLeaderboardLoading(false);
  };

  useEffect(() => {
    if (section === 'leaderboard' && leaderboard.length === 0) fetchLeaderboard();
  }, [section]);

  useEffect(() => {
    if (section === 'files' && studentFiles.length === 0) {
      setFilesLoading(true);
      fetch('/api/student/files')
        .then(r => r.ok ? r.json() : [])
        .then(data => setStudentFiles(data))
        .catch(() => {})
        .finally(() => setFilesLoading(false));
    }
  }, [section]);

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
      if (!res.ok) { setCodeError(data.error || tr('errGeneric', lang)); setUnlocking(false); return; }

      if (data.quizExists) {
        setQuestions(data.questions);
        setAnswers(Array(data.questions.length).fill(''));
        setModalStep('exam');
      } else {
        await refreshAccesses();
        setModalStep('access');
      }
    } catch {
      setCodeError(tr('errGenericNet', lang));
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
        alert(data.error || tr('errGeneric', lang));
      }
    } catch {
      alert(tr('errGenericNet', lang));
    }
    setSubmitting(false);
  };

  const passed = total > 0 ? score >= Math.ceil(total / 2) : false;
  const pct    = total > 0 ? Math.round((score / total) * 100) : 0;

  /* ════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen flex" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-64 neon-panel border-l border-slate-200 flex flex-col transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="h-20 flex items-center justify-between px-4 border-b border-slate-200 shrink-0">
          <img
            src="/logo.png"
            alt={tr('logoAlt', lang)}
            className="h-14 w-auto object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-700 p-1 rounded-lg shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {([
            { id: 'lessons',     label: tr('tabLessons', lang),     Icon: Video },
            { id: 'homework',    label: tr('tabHomework', lang),    Icon: ClipboardList },
            { id: 'files',       label: tr('tabFiles', lang),       Icon: Folder },
            { id: 'leaderboard', label: tr('tabLeaderboard', lang), Icon: Trophy },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => { setSection(id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                section === id
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Bottom: theme + lang toggles */}
        <div className="p-3 border-t border-slate-200 shrink-0 space-y-0.5">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-colors font-medium text-sm"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? tr('dayMode', lang) : tr('nightMode', lang)}
          </button>
          <button
            onClick={toggleLang}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-colors font-medium text-sm"
          >
            <Languages className="w-4 h-4 shrink-0" />
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Top header */}
        <header className="h-16 neon-panel border-b border-slate-200 flex items-center px-4 lg:px-8 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden text-slate-400 hover:text-slate-700 ml-4 p-2 rounded-xl hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? tr('dayMode', lang) : tr('nightMode', lang)}
              className="hidden lg:flex w-8 h-8 rounded-xl items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleLang}
              className="hidden lg:flex items-center gap-1 px-2 h-8 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200"
            >
              <Languages className="w-3.5 h-3.5" />
              {lang === 'ar' ? 'EN' : 'عربي'}
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8 overflow-auto">

        {/* Welcome */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{tr('welcomeHeading', lang)}</h2>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">{tr('welcomeSub', lang)}</p>
        </div>

        {/* ── Lessons Grid ── */}
        {section === 'lessons' && (loading ? (
          <div className="text-center p-12 text-slate-400">{tr('loading', lang)}</div>
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
                        {isUnlocked ? tr('lessonUnlocked', lang) : tr('lessonLocked', lang)}
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
                {tr('noLessons', lang)}
              </div>
            )}
          </div>
        ))}

        {/* ── Homework Grid ── */}
        {section === 'homework' && (homeworksLoading ? (
          <div className="text-center p-12 text-slate-400">{tr('loading', lang)}</div>
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
                      {tr('yourScore', lang)} {hw.submission.score} / {hw.submission.total}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">{tr('notAnswered', lang)}</span>
                  )}
                  <Link to={`/homework/${hw.id}`} className="neon-btn px-4 py-2 rounded-lg text-sm font-bold">
                    {hw.submission ? tr('viewHw', lang) : tr('solveHw', lang)}
                  </Link>
                </div>
              </div>
            ))}
            {homeworks.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-400 neon-card rounded-2xl">
                {tr('noHomework', lang)}
              </div>
            )}
          </div>
        ))}

        {/* ── Leaderboard ── */}
        {section === 'leaderboard' && (leaderboardLoading ? (
          <div className="text-center p-12 text-slate-400">{tr('loadingLeaderboard', lang)}</div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="neon-card rounded-2xl overflow-hidden">
              {leaderboard.length === 0 ? (
                <div className="p-12 text-center text-slate-400">{tr('noResults', lang)}</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {leaderboard.map((entry: any, i: number) => {
                    const rank = i + 1;
                    const medals = [
                      <Trophy key="1" className="w-5 h-5 text-yellow-400" />,
                      <Medal  key="2" className="w-5 h-5 text-slate-400" />,
                      <Award  key="3" className="w-5 h-5 text-amber-600" />,
                    ];
                    const bgClass = rank === 1
                      ? 'bg-yellow-50'
                      : rank === 2
                        ? 'bg-slate-50'
                        : rank === 3
                          ? 'bg-amber-50'
                          : '';
                    return (
                      <div key={entry.id} className={`flex items-center gap-4 px-5 py-4 ${bgClass}`}>
                        <div className="w-8 shrink-0 flex items-center justify-center">
                          {rank <= 3
                            ? medals[rank - 1]
                            : <span className="text-sm font-bold text-slate-400">{rank}</span>}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {entry.picture
                            ? <img src={entry.picture} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover" />
                            : <span className="text-sm font-bold text-indigo-700">{(entry.name || '؟')[0]}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 truncate text-sm">{entry.name}</p>
                          <p className="text-xs text-slate-400">
                            {entry.gradeLevel === '2nd_sec' ? tr('gradeLabel2', lang) : entry.gradeLevel === '3rd_sec' ? tr('gradeLabel3', lang) : ''}
                          </p>
                        </div>
                        <div className="text-left shrink-0">
                          <p className="font-bold text-indigo-700 text-sm">{entry.percentage}%</p>
                          <p className="text-xs text-slate-400">{entry.totalScore}/{entry.totalPossible} {tr('scoreUnit', lang)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* ── Files ── */}
        {section === 'files' && (filesLoading ? (
          <div className="text-center p-12 text-slate-400">{tr('loading', lang)}</div>
        ) : (
          <div className="space-y-3">
            <p className="text-slate-500 text-sm mb-5">{tr('filesSubtitle', lang)}</p>
            {studentFiles.map((f: any) => (
              <div key={f.id} className="neon-card rounded-2xl p-4 flex items-center gap-4">
                <img
                  src="/folder-icon.png"
                  alt="ملف"
                  className="w-10 h-10 object-contain shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">{f.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{f.fileName}</p>
                </div>
                <a
                  href={f.fileUrl}
                  download={f.fileName}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl neon-btn text-sm font-bold shrink-0"
                >
                  <Download className="w-4 h-4" />
                  {tr('downloadFile', lang)}
                </a>
              </div>
            ))}
            {studentFiles.length === 0 && (
              <div className="p-12 text-center text-slate-400 neon-card rounded-2xl">
                <img
                  src="/folder-icon.png"
                  alt="ملفات"
                  className="w-14 h-14 mx-auto mb-3 opacity-40"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <p>{tr('noFiles', lang)}</p>
              </div>
            )}
          </div>
        ))}

        </div>{/* end .flex-1.p-4 */}
      </main>

      {/* ════════════════════════════════════════════════════
          Modal: Code → Exam → Results / Access
      ════════════════════════════════════════════════════ */}
      {modalLesson && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
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
                src={fullscreenImg} alt={tr('questionImg', lang)}
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
                  {modalStep === 'code'    ? tr('modalCodeStep', lang)
                  : modalStep === 'exam'   ? tr('modalExamStep', lang)
                  : modalStep === 'results'? tr('modalResultsStep', lang)
                  :                          tr('modalAccessStep', lang)}
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
                    <h2 className="text-xl font-bold text-slate-900 mb-1">{tr('accessCodeTitle', lang)}</h2>
                    <p className="text-sm text-slate-500">{tr('accessCodeSub', lang)}</p>
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
                            {tr('verifying', lang)}
                          </span>
                        : tr('activateCode', lang)}
                    </button>
                  </form>
                </div>
              )}

              {/* ── STEP: exam ── */}
              {modalStep === 'exam' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-slate-500">{tr('examInstructions', lang)}</p>
                    <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full shrink-0">
                      {questions.length} {tr('questionWord', lang)}
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
                              src={q.image} alt={`${tr('questionImg', lang)} ${idx + 1}`}
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
                          <p className="text-red-500 text-xs font-semibold">{tr('answerRequired', lang)}</p>
                        )}
                      </div>
                    );
                  })}

                  <button
                    onClick={handleSubmitExam} disabled={submitting}
                    className="neon-btn w-full py-4 rounded-xl font-bold text-base disabled:opacity-50 mt-2"
                  >
                    {submitting ? tr('submitting', lang) : tr('submitExam', lang)}
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
                      {passed ? tr('passed', lang) : score < 5 ? tr('failedLow', lang) : tr('failed', lang)}
                    </p>
                    {passed && (
                      <Link
                        to={`/lessons/${modalLesson.id}`}
                        className="neon-btn inline-block mt-4 px-8 py-3 rounded-xl font-bold text-base"
                      >
                        {tr('enterLesson', lang)}
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
                            src={r.image} alt={`${tr('questionImg', lang)} ${idx + 1}`}
                            className="w-full max-h-80 object-contain rounded-xl border border-slate-200 bg-white"
                          />
                          <button className="absolute top-2 left-2 bg-black/40 hover:bg-black/60 text-white rounded-lg p-1.5 sm:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Maximize2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 font-bold ${r.isCorrect ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                          <span className="text-xs text-slate-400 font-normal shrink-0">{tr('yourAnswer', lang)}</span>
                          <span>{r.studentAnswer ?? '—'}</span>
                          {r.studentAnswer && <span className="text-xs opacity-60">({ANSWER_LABELS[r.studentAnswer] ?? ''})</span>}
                        </div>
                        <div className="flex items-center gap-2 rounded-xl px-4 py-3 font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          <span className="text-xs text-slate-400 font-normal shrink-0">{tr('correctAnswer', lang)}</span>
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
                    {tr('backToDash', lang)}
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
                    <h2 className="text-xl font-bold text-slate-900">{tr('lessonOpenedTitle', lang)}</h2>
                    <p className="text-slate-500 text-sm mt-1">{modalLesson.title}</p>
                  </div>
                  <Link
                    to={`/lessons/${modalLesson.id}`}
                    className="neon-btn w-full py-4 rounded-xl font-bold text-base block"
                  >
                    {tr('enterLesson', lang)}
                  </Link>
                  <button onClick={closeModal} className="w-full text-slate-400 hover:text-indigo-600 text-sm transition-colors">
                    {tr('backToDash', lang)}
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
