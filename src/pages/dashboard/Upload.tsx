import { useState, useEffect, FormEvent } from 'react';
import { Video, Trash2, Eye, EyeOff, Plus, PlayCircle } from 'lucide-react';

export function UploadVideo() {
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Lesson Form
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonGrade, setLessonGrade] = useState('2nd_sec');
  const [lessonPlatform, setLessonPlatform] = useState('youtube');
  const [lessonUrl, setLessonUrl] = useState('');

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/youchem/lessons');
      if (res.ok) {
        setLessons(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleAddLesson = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/youchem/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: lessonTitle, 
          gradeLevel: lessonGrade,
          platform: lessonPlatform, 
          videoUrl: lessonUrl
        })
      });
      if (res.ok) {
        setLessonTitle('');
        setLessonUrl('');
        setShowLessonForm(false);
        fetchLessons();
      }
    } catch (err) {
      alert('حدث خطأ أثناء إضافة الحصة');
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف الحصة؟ سيتم حذف جميع الاختبارات والبيانات المتعلقة بها.')) return;
    try {
      const res = await fetch(`/api/youchem/lessons/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchLessons();
      }
    } catch (err) {
      alert('فشل في الحذف');
    }
  };

  const handleToggleVisibility = async (id: string) => {
    try {
      const res = await fetch(`/api/youchem/lessons/${id}/toggle-visibility`, { method: 'PATCH' });
      if (res.ok) {
        fetchLessons();
      }
    } catch (err) {
      alert('فشل في التعديل');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">إدارة الحصص</h1>
          <p className="text-slate-500 mt-1">إضافة وإدارة الفيديوهات</p>
        </div>
        <button 
          onClick={() => setShowLessonForm(!showLessonForm)}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          إضافة فيديو جديد
        </button>
      </div>

      {showLessonForm && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4">
          <h2 className="text-lg font-bold mb-4">إضافة فيديو جديد</h2>
          <form onSubmit={handleAddLesson} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-2 lg:col-span-1">
              <label className="block text-sm font-semibold text-slate-700">الصف الدراسي</label>
              <select value={lessonGrade} onChange={(e) => setLessonGrade(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500">
                <option value="2nd_sec">الثاني الثانوي</option>
                <option value="3rd_sec">الثالث الثانوي</option>
              </select>
            </div>
            <div className="space-y-2 lg:col-span-1">
              <label className="block text-sm font-semibold text-slate-700">عنوان الدرس</label>
              <input type="text" required value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <label className="block text-sm font-semibold text-slate-700">المنصة</label>
              <select value={lessonPlatform} onChange={(e) => setLessonPlatform(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500">
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo</option>
              </select>
            </div>
            <div className="space-y-2 lg:col-span-1">
              <label className="block text-sm font-semibold text-slate-700">الرابط أو الـ ID</label>
              <input type="text" required value={lessonUrl} onChange={(e) => setLessonUrl(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500" dir="ltr" />
            </div>
            <div className="lg:col-span-1 flex gap-2">
              <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
                حفظ
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center p-8 text-slate-500">جاري التحميل...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {lessons.length === 0 ? (
              <div className="p-8 text-slate-500 text-center">
                لا توجد حصص مضافة حتى الآن.
              </div>
            ) : (
              lessons.map((lesson: any) => (
                <div key={lesson.id} className={`p-6 flex items-center justify-between transition-colors hover:bg-slate-50 ${lesson.isHidden ? 'opacity-60 bg-slate-50' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${lesson.platform === 'youtube' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                      <Video className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-slate-900 flex items-center gap-3">
                        {lesson.title}
                        {lesson.isHidden && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md">مخفي</span>}
                        {lesson.isFree && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-md">مجاني</span>}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-slate-500">
                          {lesson.gradeLevel === '2nd_sec' ? 'الثاني الثانوي' : 'الثالث الثانوي'}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span className="text-sm text-slate-500 uppercase tracking-wider">{lesson.platform}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleToggleVisibility(lesson.id)}
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={lesson.isHidden ? "إظهار الحصة" : "إخفاء الحصة"}
                    >
                      {lesson.isHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                    <button 
                      onClick={() => handleDeleteLesson(lesson.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="حذف الحصة"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
