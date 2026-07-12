import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

export function Students() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // In a real application, you'd likely fetch chapters/lessons here 
  // to populate a dropdown for the exemption. 
  // For simplicity based on requirements, we'll list students, 
  // and we need a way to exempt them from a specific lesson.
  const [lessons, setLessons] = useState<any[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studentsRes, lessonsRes] = await Promise.all([
        fetch('/api/youchem/students'),
        fetch('/api/youchem/lessons')
      ]);
      
      if (studentsRes.ok && lessonsRes.ok) {
        setStudents(await studentsRes.json());
        
        const allLessons = await lessonsRes.json();
        setLessons(allLessons);
        if (allLessons.length > 0) {
          setSelectedLessonId(allLessons[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleToggleExempt = async (userId: string) => {
    if (!selectedLessonId) return alert('الرجاء اختيار حصة أولاً');
    try {
      const res = await fetch(`/api/youchem/students/${userId}/lessons/${selectedLessonId}/exempt`, {
        method: 'PATCH'
      });
      if (res.ok) {
        // Refresh students to get new access state
        fetchData();
      }
    } catch (err) {
      alert('حدث خطأ');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">سجل الطلاب</h1>
        <p className="text-slate-400 mt-1">متابعة الطلاب المسجلين وإدارة استثناءات الاختبارات (Exemptions)</p>
      </div>
      
      <div className="neon-card p-6 rounded-2xl flex items-center gap-4">
        <label className="font-semibold text-slate-300">اختر الحصة لعرض وإدارة الاستثناءات:</label>
        <select 
          value={selectedLessonId} 
          onChange={(e) => setSelectedLessonId(e.target.value)}
          className="neon-input flex-1 max-w-xs px-4 py-2 rounded-xl"
        >
          {lessons.map(l => (
            <option key={l.id} value={l.id}>{l.title}</option>
          ))}
          {lessons.length === 0 && <option value="">لا توجد حصص</option>}
        </select>
      </div>

      <div className="neon-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">جاري التحميل...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-black/20 border-b border-cyan-500/10 text-slate-300">
                <tr>
                  <th className="p-4 font-semibold">الاسم</th>
                  <th className="p-4 font-semibold">البريد الإلكتروني</th>
                  <th className="p-4 font-semibold">رقم الهاتف</th>
                  <th className="p-4 font-semibold">المدرسة</th>
                  <th className="p-4 font-semibold">الصف</th>
                  <th className="p-4 font-semibold text-center">إعفاء من الاختبار (Exempt)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-500/10">
                {students.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">لا يوجد طلاب مسجلين.</td>
                  </tr>
                )}
                {students.map(student => {
                  const access = student.accesses?.find((a: any) => a.lessonId === selectedLessonId);
                  const isExempt = access?.quizExempt || false;

                  return (
                    <tr key={student.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-white">{student.name}</td>
                      <td className="p-4 text-slate-400">{student.email}</td>
                      <td className="p-4 text-slate-400" dir="ltr">{student.phone || '-'}</td>
                      <td className="p-4 text-slate-400">{student.school || '-'}</td>
                      <td className="p-4 text-slate-400">
                        {student.gradeLevel === '2nd_sec' ? 'الثاني الثانوي' : student.gradeLevel === '3rd_sec' ? 'الثالث الثانوي' : '-'}
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => handleToggleExempt(student.id)}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                            isExempt 
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20' 
                              : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {isExempt ? (
                            <><ShieldCheck className="w-4 h-4" /> معفى</>
                          ) : (
                            <><ShieldAlert className="w-4 h-4" /> تفعيل الإعفاء</>
                          )}
                        </button>
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
