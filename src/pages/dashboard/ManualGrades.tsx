import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle, ClipboardCheck, Search, UserRound } from 'lucide-react';

type Student = {
  id: string;
  name: string;
  email: string;
  phone?: string;
};

type ManualGrade = {
  id: string;
  studentId: string;
  examName: string;
  score: number;
  percentage: number;
  confirmed: boolean;
  confirmedAt?: string;
};

export function ManualGrades() {
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<ManualGrade[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [examName, setExamName] = useState('');
  const [score, setScore] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/youchem/manual-grades');
      if (!res.ok) throw new Error('تعذر تحميل البيانات');
      const data = await res.json();
      setStudents(data.students);
      setGrades(data.grades);
    } catch (err: any) {
      setError(err.message || 'في مشكلة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return students.filter(student =>
      [student.name, student.email, student.phone].some(value => (value || '').toLowerCase().includes(q)),
    ).slice(0, 8);
  }, [students, search]);

  const studentGrades = useMemo(
    () => grades.filter(grade => grade.studentId === selectedStudent?.id),
    [grades, selectedStudent],
  );

  const submitGrade = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedStudent) return setError('اختار الطالب الأول');
    setSaving(true);
    try {
      const res = await fetch('/api/youchem/manual-grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudent.id, examName, score: Number(score) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذر حفظ الدرجة');
        return;
      }
      setGrades(current => [data, ...current.filter(g => g.id !== data.id)]);
      setExamName('');
      setScore('');
      setSuccess('تم تأكيد الدرجة وإرسالها للطالب');
    } catch {
      setError('في مشكلة في الاتصال');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">درجات الامتحان</h1>
        <p className="text-slate-500 text-sm mt-1">ابحث عن الطالب وسجّل درجته من 60، والطالب هيشوف النتيجة عند دخوله.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-6 items-start">
        <section className="neon-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Search className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900">اختيار الطالب</h2>
          </div>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setError(''); }}
              placeholder="ابحث بالاسم أو الإيميل أو رقم الطالب..."
              className="neon-input w-full pr-10 pl-4 py-3 rounded-xl text-sm"
            />
          </div>
          {search && (
            <div className="mt-3 space-y-2">
              {results.map(student => (
                <button
                  key={student.id}
                  onClick={() => { setSelectedStudent(student); setSearch(student.name); setSuccess(''); }}
                  className={`w-full text-right p-3 rounded-xl border transition-colors ${selectedStudent?.id === student.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <p className="font-bold text-sm text-slate-800">{student.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{student.email} {student.phone ? `— ${student.phone}` : ''}</p>
                </button>
              ))}
              {!loading && results.length === 0 && <p className="text-sm text-slate-400 p-3">مفيش طالب مطابق للبحث.</p>}
            </div>
          )}
          {selectedStudent && (
            <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <UserRound className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="font-bold text-emerald-800 text-sm">{selectedStudent.name}</p>
                <p className="text-xs text-emerald-700">{selectedStudent.email}</p>
              </div>
            </div>
          )}
        </section>

        <section className="neon-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900">تسجيل درجة جديدة</h2>
          </div>
          <form onSubmit={submitGrade} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">اسم الامتحان</label>
              <input value={examName} onChange={e => setExamName(e.target.value)} required placeholder="مثال: امتحان الباب الأول" className="neon-input w-full px-4 py-3 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">الدرجة من 60</label>
              <input type="number" min="0" max="60" step="0.01" value={score} onChange={e => setScore(e.target.value)} required placeholder="اكتب الدرجة" className="neon-input w-full px-4 py-3 rounded-xl" dir="ltr" />
            </div>
            {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}
            {success && <p className="text-emerald-600 text-sm font-semibold flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</p>}
            <button disabled={saving || !selectedStudent} className="neon-btn w-full py-3 rounded-xl font-bold disabled:opacity-50">
              {saving ? 'بيتم التأكيد...' : 'تأكيد وإضافة الدرجة'}
            </button>
          </form>
        </section>
      </div>

      <section className="neon-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-900">الدرجات المؤكدة</h2>
        </div>
        {loading ? <p className="p-8 text-center text-slate-400">بيتحمل...</p> : grades.length === 0 ? (
          <p className="p-8 text-center text-slate-400">لسه مفيش درجات متسجلة.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {grades.map(grade => {
              const student = students.find(item => item.id === grade.studentId);
              return (
                <div key={grade.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 text-sm">{student?.name || 'طالب'}</p>
                    <p className="text-xs text-slate-500 mt-1">{grade.examName}</p>
                  </div>
                  <span className="font-black text-indigo-600">{grade.score}/60</span>
                  <span className="text-sm text-slate-500">{grade.percentage}%</span>
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> مؤكدة</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}