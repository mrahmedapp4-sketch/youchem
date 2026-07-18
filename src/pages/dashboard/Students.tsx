import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Ban, ShieldOff, Trash2 } from 'lucide-react';

export function Students() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState<any[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sRes, lRes] = await Promise.all([fetch('/api/youchem/students'), fetch('/api/youchem/lessons')]);
      if (sRes.ok && lRes.ok) {
        setStudents(await sRes.json());
        const all = await lRes.json();
        setLessons(all);
        if (all.length > 0) setSelectedLessonId(all[0].id);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleToggleExempt = async (userId: string) => {
    if (!selectedLessonId) return alert('الرجاء اختيار حصة أولاً');
    try {
      const res = await fetch(`/api/youchem/students/${userId}/lessons/${selectedLessonId}/exempt`, { method: 'PATCH' });
      if (res.ok) fetchData();
    } catch { alert('حدث خطأ'); }
  };

  const handleToggleBlock = async (userId: string) => {
    try {
      const res = await fetch(`/api/youchem/students/${userId}/block`, { method: 'PATCH' });
      if (res.ok) fetchData();
      else alert('حدث خطأ');
    } catch { alert('حدث خطأ'); }
  };

  const handleDeleteStudent = async (userId: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب "${name}" نهائياً؟ لا يمكن التراجع.`)) return;
    try {
      const res = await fetch(`/api/youchem/students/${userId}`, { method: 'DELETE' });
      if (res.ok) fetchData();
      else alert('حدث خطأ');
    } catch { alert('حدث خطأ'); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      <div>
        <h1 className="text-xl font-bold text-slate-900">سجل الطلاب</h1>
        <p className="text-slate-500 text-sm mt-0.5">متابعة الطلاب المسجلين وإدارة الاستثناءات والحظر</p>
      </div>

      {/* Lesson selector */}
      <div className="neon-card p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <label className="font-semibold text-slate-700 text-sm shrink-0">الحصة للاستثناءات:</label>
        <select
          value={selectedLessonId} onChange={e => setSelectedLessonId(e.target.value)}
          className="neon-input flex-1 max-w-xs px-4 py-2 rounded-xl text-sm"
        >
          {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
          {lessons.length === 0 && <option value="">لا توجد حصص</option>}
        </select>
      </div>

      {/* Table */}
      <div className="neon-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">جاري التحميل...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3">الاسم</th>
                  <th className="px-5 py-3">البريد الإلكتروني</th>
                  <th className="px-5 py-3">الصف</th>
                  <th className="px-5 py-3 text-center">استثناء الاختبار</th>
                  <th className="px-5 py-3 text-center">إدارة الحساب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.length === 0 && (
                  <tr><td colSpan={5} className="p-10 text-center text-slate-400 text-sm">لا يوجد طلاب مسجلون حتى الآن.</td></tr>
                )}
                {students.map((student: any) => {
                  const accessForLesson = student.lessonAccesses?.find((a: any) => a.lessonId === selectedLessonId);
                  const isExempt = accessForLesson?.quizExempt || false;
                  const isBlocked = student.blocked || false;
                  return (
                    <tr key={student.id} className={`hover:bg-slate-50 transition-colors ${isBlocked ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-4 font-bold text-slate-900 text-sm">
                        <div className="flex items-center gap-2">
                          {student.name || 'غير معروف'}
                          {isBlocked && (
                            <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full font-medium">محظور</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-500 text-sm">{student.email}</td>
                      <td className="px-5 py-4 text-slate-500 text-sm">
                        {student.gradeLevel === '2nd_sec' ? 'الثاني الثانوي' : student.gradeLevel === '3rd_sec' ? 'الثالث الثانوي' : '—'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => handleToggleExempt(student.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors border ${
                            isExempt
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isExempt ? <><ShieldCheck className="w-3.5 h-3.5" /> معفى</> : <><ShieldAlert className="w-3.5 h-3.5" /> تفعيل الإعفاء</>}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleToggleBlock(student.id)}
                            title={isBlocked ? 'إلغاء الحظر' : 'حظر الطالب'}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors border ${
                              isBlocked
                                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isBlocked ? <ShieldOff className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(student.id, student.name)}
                            title="حذف الحساب"
                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
