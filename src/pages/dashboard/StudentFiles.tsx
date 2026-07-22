import { useState, useEffect } from 'react';
import { Search, FolderOpen, Download, ChevronDown, ChevronUp, Clock, CheckCircle, XCircle, BookOpen, FileText } from 'lucide-react';

const GRADE_LABEL: Record<string, string> = {
  '2nd_sec': 'تاني ثانوي',
  '3rd_sec': 'تالت ثانوي',
};

export function StudentFiles() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'' | '2nd_sec' | '3rd_sec'>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fileData, setFileData] = useState<Record<string, any>>({});
  const [fileLoading, setFileLoading] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/youchem/students')
      .then(r => r.json())
      .then(d => { setStudents(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const openStudentFile = async (userId: string) => {
    if (selectedId === userId) { setSelectedId(null); return; }
    setSelectedId(userId);
    if (fileData[userId]) return; // already loaded
    setFileLoading(userId);
    try {
      const res = await fetch(`/api/youchem/student-file/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setFileData(prev => ({ ...prev, [userId]: data }));
      }
    } catch { /* ignore */ }
    setFileLoading(null);
  };

  const handleDownload = async (userId: string, studentName: string) => {
    setDownloading(userId);
    try {
      const res = await fetch(`/api/youchem/student-file/${userId}/download`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${studentName || userId}_ملف.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { alert('في مشكلة في التحميل'); }
    setDownloading(null);
  };

  const filtered = students
    .filter(s => !gradeFilter || s.gradeLevel === gradeFilter)
    .filter(s =>
      !search ||
      (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.school || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

  return (
    <div className="max-w-5xl mx-auto space-y-5" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">ملفات الطلاب</h1>
        <p className="text-slate-500 text-sm mt-0.5">شوف تفاصيل كل طالب — وقت المشاهدة، الامتحانات، الواجبات — وحمّل ملفه</p>
      </div>

      {/* Filters */}
      <div className="neon-card p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex rounded-xl overflow-hidden border border-slate-200 shrink-0">
          {([['', 'الكل'], ['2nd_sec', 'تاني ثانوي'], ['3rd_sec', 'تالت ثانوي']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setGradeFilter(val)}
              className={`px-3 py-2 text-sm font-semibold transition-colors ${gradeFilter === val ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="ابحث باسم الطالب أو الإيميل أو المدرسة..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="neon-input w-full pr-9 pl-3 py-2.5 rounded-xl text-sm"
          />
        </div>
        <span className="text-xs text-slate-400 shrink-0">{filtered.length} طالب</span>
      </div>

      {/* Student list */}
      <div className="neon-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">بيتحمل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <FolderOpen className="w-8 h-8 text-slate-300" />
            مفيش طلاب
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(student => {
              const isOpen = selectedId === student.id;
              const file = fileData[student.id];
              const isLoadingFile = fileLoading === student.id;
              const isDownloading = downloading === student.id;

              return (
                <div key={student.id}>
                  {/* Student row */}
                  <div
                    className={`flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors ${isOpen ? 'bg-indigo-50/50' : ''}`}
                    onClick={() => openStudentFile(student.id)}
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {student.picture
                        ? <img src={student.picture} alt="" className="w-full h-full object-cover" />
                        : <span className="text-indigo-700 font-bold text-sm">{(student.name || '؟')[0]}</span>
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 text-sm truncate">{student.name || '—'}</div>
                      <div className="text-xs text-slate-400 truncate">{student.email}</div>
                    </div>

                    {/* Grade badge */}
                    {student.gradeLevel && (
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full shrink-0 hidden sm:inline-flex">
                        {GRADE_LABEL[student.gradeLevel]}
                      </span>
                    )}

                    {/* Activity summary */}
                    <div className="text-xs text-slate-400 shrink-0 hidden md:block text-center min-w-[80px]">
                      <div className="font-semibold text-slate-700">{(student.accesses || []).length} حصة</div>
                      <div>مفتوحة</div>
                    </div>

                    {/* Download */}
                    <button
                      onClick={e => { e.stopPropagation(); handleDownload(student.id, student.name); }}
                      disabled={isDownloading}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0 disabled:opacity-40"
                      title="تحميل ملف Excel"
                    >
                      {isDownloading
                        ? <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        : <Download className="w-4 h-4" />
                      }
                    </button>

                    {/* Toggle */}
                    {isOpen
                      ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    }
                  </div>

                  {/* Expanded student file */}
                  {isOpen && (
                    <div className="bg-slate-50 border-t border-slate-100 px-5 py-5 space-y-5">
                      {isLoadingFile ? (
                        <div className="text-center py-6 text-slate-400 text-sm">بيتحمل الملف...</div>
                      ) : !file ? (
                        <div className="text-center py-6 text-red-400 text-sm">في مشكلة في تحميل الملف</div>
                      ) : (
                        <>
                          {/* Profile card */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <InfoCard label="الاسم" value={file.user.name} />
                            <InfoCard label="الإيميل" value={file.user.email} />
                            <InfoCard label="الهاتف" value={file.user.phone || '—'} />
                            <InfoCard label="هاتف ولي الأمر" value={file.user.guardianPhone || '—'} />
                            <InfoCard label="المدرسة" value={file.user.school || '—'} />
                            <InfoCard label="الصف" value={GRADE_LABEL[file.user.gradeLevel] || '—'} />
                          </div>

                          {/* Lessons */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <BookOpen className="w-4 h-4 text-indigo-500" />
                              <span className="font-semibold text-slate-800 text-sm">الحصص ({file.accesses.length})</span>
                            </div>
                            {file.accesses.length === 0 ? (
                              <p className="text-xs text-slate-400">ما فتحش أي حصة لسه</p>
                            ) : (
                              <div className="space-y-2">
                                {file.accesses.map((a: any, i: number) => (
                                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-3">
                                    <span className="font-semibold text-slate-800 text-sm flex-1 min-w-[120px] truncate">{a.lessonTitle}</span>
                                    {/* Viewing time */}
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                                      <span>{a.viewingMinutes || 0} دقيقة</span>
                                    </div>
                                    {/* Quiz result */}
                                    {a.quizExempt ? (
                                      <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1.5 rounded-lg font-semibold">معفي</span>
                                    ) : a.quizTotal != null ? (
                                      <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-semibold border ${a.quizPassed ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                                        {a.quizPassed ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                        امتحان: {a.quizScore}/{a.quizTotal}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-400">ما عدّاش الامتحان</span>
                                    )}
                                    {/* Unlock date */}
                                    <span className="text-xs text-slate-400">{new Date(a.unlockedAt).toLocaleDateString('ar-EG')}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Homework */}
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <FileText className="w-4 h-4 text-indigo-500" />
                              <span className="font-semibold text-slate-800 text-sm">الواجبات ({file.homeworkSubmissions.length})</span>
                            </div>
                            {file.homeworkSubmissions.length === 0 ? (
                              <p className="text-xs text-slate-400">ما سلّم أي واجب لسه</p>
                            ) : (
                              <div className="space-y-2">
                                {file.homeworkSubmissions.map((s: any, i: number) => (
                                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-3">
                                    <span className="font-semibold text-slate-800 text-sm flex-1 min-w-[120px] truncate">{s.homeworkTitle}</span>
                                    <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-semibold border ${s.score / s.total >= 0.5 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                                      درجة: {s.score}/{s.total}
                                      <span className="text-xs opacity-70">({Math.round((s.score / s.total) * 100)}%)</span>
                                    </div>
                                    <span className="text-xs text-slate-400">{new Date(s.createdAt).toLocaleDateString('ar-EG')}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Download button */}
                          <div className="pt-1">
                            <button
                              onClick={() => handleDownload(file.user.id, file.user.name)}
                              disabled={isDownloading}
                              className="neon-btn flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
                            >
                              {isDownloading
                                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <Download className="w-4 h-4" />
                              }
                              تحميل ملف Excel
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <div className="font-semibold text-slate-800 text-sm truncate">{value}</div>
    </div>
  );
}
