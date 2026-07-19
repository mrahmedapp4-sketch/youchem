import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';

const GRADE_LABEL: Record<string, string> = {
  '2nd_sec': 'الثاني الثانوي',
  '3rd_sec': 'الثالث الثانوي',
};

export function QuizGrades() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gradeFilter, setGradeFilter] = useState<'2nd_sec' | '3rd_sec'>('2nd_sec');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/youchem/grades/quiz')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10 text-center text-slate-400 text-sm">جاري التحميل...</div>;
  if (!data) return <div className="p-10 text-center text-red-400 text-sm">حدث خطأ في التحميل</div>;

  const { students, lessons, accesses } = data;

  // Lessons that have at least one access with a quizScore (meaning a quiz exists)
  // AND belong to the selected grade
  const accessedLessonIds = new Set(
    accesses.filter((a: any) => a.quizTotal != null).map((a: any) => a.lessonId)
  );
  const gradeLessons = lessons
    .filter((l: any) => l.gradeLevel === gradeFilter && accessedLessonIds.has(l.id))
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Students in the selected grade, filtered by search
  const gradeStudents = students
    .filter((s: any) => s.gradeLevel === gradeFilter)
    .filter((s: any) =>
      !search || (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'ar'));

  // Lookup: access by userId+lessonId
  const accessKey = (userId: string, lessonId: string) => `${userId}__${lessonId}`;
  const accessMap: Record<string, any> = {};
  accesses.forEach((a: any) => { accessMap[accessKey(a.userId, a.lessonId)] = a; });

  return (
    <div className="max-w-full space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">درجات الاختبارات</h1>
        <p className="text-slate-500 text-sm mt-0.5">درجة كل طالب في اختبار كل حصة</p>
      </div>

      {/* Controls */}
      <div className="neon-card p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex rounded-xl overflow-hidden border border-slate-200 shrink-0">
          {(['2nd_sec', '3rd_sec'] as const).map(g => (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                gradeFilter === g
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {GRADE_LABEL[g]}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="بحث باسم الطالب أو البريد..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="neon-input flex-1 px-4 py-2 rounded-xl text-sm"
        />
        <span className="text-xs text-slate-400 shrink-0">{gradeStudents.length} طالب</span>
      </div>

      {/* Table */}
      <div className="neon-card rounded-2xl overflow-hidden">
        {gradeLessons.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <Trophy className="w-8 h-8 text-slate-300" />
            لم يجتز أي طالب اختباراً في هذا الصف بعد
          </div>
        ) : gradeStudents.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">لا يوجد طلاب مسجلون في هذا الصف</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap sticky right-0 bg-slate-50 z-10 min-w-[160px]">
                    الطالب
                  </th>
                  {gradeLessons.map((l: any) => (
                    <th key={l.id} className="px-3 py-3 font-semibold text-slate-600 text-xs text-center whitespace-nowrap max-w-[120px]">
                      <span className="block truncate max-w-[120px]" title={l.title}>{l.title}</span>
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-slate-600 text-xs text-center whitespace-nowrap">
                    الإجمالي
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gradeStudents.map((student: any) => {
                  let totalScore = 0, totalPossible = 0;
                  const cells = gradeLessons.map((lesson: any) => {
                    const acc = accessMap[accessKey(student.id, lesson.id)];
                    if (acc && acc.quizTotal != null) {
                      totalScore += acc.quizScore ?? 0;
                      totalPossible += acc.quizTotal;
                    }
                    return (
                      <td key={lesson.id} className="px-3 py-3 text-center whitespace-nowrap">
                        {acc && acc.quizTotal != null ? (
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg font-bold text-xs ${
                            acc.quizPassed
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-600 border border-red-200'
                          }`}>
                            {acc.quizScore ?? 0}/{acc.quizTotal}
                          </span>
                        ) : acc ? (
                          <span className="text-xs text-amber-500">معفى</span>
                        ) : (
                          <span className="text-xs text-slate-400">لم يجتز</span>
                        )}
                      </td>
                    );
                  });
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 sticky right-0 bg-white hover:bg-slate-50 z-10">
                        <div className="font-semibold text-slate-900 text-sm">{student.name || '—'}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[150px]">{student.email}</div>
                      </td>
                      {cells}
                      <td className="px-4 py-3 text-center">
                        {totalPossible > 0 ? (
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg font-bold text-xs ${
                            totalScore / totalPossible >= 0.5
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-orange-50 text-orange-600 border border-orange-200'
                          }`}>
                            {totalScore}/{totalPossible}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
