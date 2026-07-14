import { useState, useEffect, FormEvent } from 'react';
import { Video, Trash2, Eye, EyeOff, Plus, PlayCircle, Pencil, X } from 'lucide-react';

export function UploadVideo() {
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Lesson Form
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonGrade, setLessonGrade] = useState('2nd_sec');
  const [lessonPlatform, setLessonPlatform] = useState('youtube');
  const [lessonUrl, setLessonUrl] = useState('');

  // Editing an existing lesson (platform/link/title/grade)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editGrade, setEditGrade] = useState('2nd_sec');
  const [editPlatform, setEditPlatform] = useState('youtube');
  const [editUrl, setEditUrl] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

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

  const openEditLesson = (lesson: any) => {
    setEditingLessonId(lesson.id);
    setEditTitle(lesson.title);
    setEditGrade(lesson.gradeLevel);
    setEditPlatform(lesson.platform);
    setEditUrl(lesson.videoUrl);
  };

  const closeEditLesson = () => setEditingLessonId(null);

  const handleSaveEditLesson = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingLessonId) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/youchem/lessons/${editingLessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          gradeLevel: editGrade,
          platform: editPlatform,
          videoUrl: editUrl,
        }),
      });
      if (res.ok) {
        setEditingLessonId(null);
        fetchLessons();
      } else {
        alert('حدث خطأ أثناء حفظ التعديل');
      }
    } catch (err) {
      alert('حدث خطأ أثناء حفظ التعديل');
    }
    setSavingEdit(false);
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
          <h1 className="text-2xl font-bold text-white">إدارة الحصص</h1>
          <p className="text-slate-400 mt-1">إضافة وإدارة الفيديوهات</p>
        </div>
        <button 
          onClick={() => setShowLessonForm(!showLessonForm)}
          className="neon-btn px-6 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          إضافة فيديو جديد
        </button>
      </div>

      {showLessonForm && (
        <div className="neon-card p-6 rounded-2xl animate-in fade-in slide-in-from-top-4">
          <h2 className="text-lg font-bold mb-4 text-white">إضافة فيديو جديد</h2>
          <form onSubmit={handleAddLesson} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-2 lg:col-span-1">
              <label className="block text-sm font-semibold text-slate-300">الصف الدراسي</label>
              <select value={lessonGrade} onChange={(e) => setLessonGrade(e.target.value)} className="neon-input w-full px-4 py-2 rounded-xl">
                <option value="2nd_sec">الثاني الثانوي</option>
                <option value="3rd_sec">الثالث الثانوي</option>
              </select>
            </div>
            <div className="space-y-2 lg:col-span-1">
              <label className="block text-sm font-semibold text-slate-300">عنوان الدرس</label>
              <input type="text" required value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} className="neon-input w-full px-4 py-2 rounded-xl" />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <label className="block text-sm font-semibold text-slate-300">المنصة</label>
              <select value={lessonPlatform} onChange={(e) => setLessonPlatform(e.target.value)} className="neon-input w-full px-4 py-2 rounded-xl">
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo</option>
              </select>
            </div>
            <div className="space-y-2 lg:col-span-1">
              <label className="block text-sm font-semibold text-slate-300">الرابط أو الـ ID</label>
              <input type="text" required value={lessonUrl} onChange={(e) => setLessonUrl(e.target.value)} className="neon-input w-full px-4 py-2 rounded-xl" dir="ltr" />
            </div>
            <div className="lg:col-span-1 flex gap-2">
              <button type="submit" className="neon-btn w-full px-4 py-2.5 rounded-xl font-semibold">
                حفظ
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center p-8 text-slate-400">جاري التحميل...</div>
      ) : (
        <div className="neon-card rounded-2xl overflow-hidden">
          <div className="divide-y divide-cyan-500/10">
            {lessons.length === 0 ? (
              <div className="p-8 text-slate-400 text-center">
                لا توجد حصص مضافة حتى الآن.
              </div>
            ) : (
              lessons.map((lesson: any) => (
                <div key={lesson.id} className={`p-6 flex items-center justify-between transition-colors hover:bg-white/5 ${lesson.isHidden ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${lesson.platform === 'youtube' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-cyan-400/10 text-cyan-300 border border-cyan-400/20'}`}>
                      <Video className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-white flex items-center gap-3">
                        {lesson.title}
                        {lesson.isHidden && <span className="text-xs bg-white/10 text-slate-300 px-2 py-0.5 rounded-md">مخفي</span>}
                        {lesson.isFree && <span className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-md">مجاني</span>}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-slate-400">
                          {lesson.gradeLevel === '2nd_sec' ? 'الثاني الثانوي' : 'الثالث الثانوي'}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                        <span className="text-sm text-slate-400 uppercase tracking-wider">{lesson.platform}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditLesson(lesson)}
                      className="p-2 text-slate-400 hover:text-cyan-300 hover:bg-cyan-400/10 rounded-lg transition-colors"
                      title="تعديل الحصة (الرابط/المنصة)"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleToggleVisibility(lesson.id)}
                      className="p-2 text-slate-400 hover:text-cyan-300 hover:bg-cyan-400/10 rounded-lg transition-colors"
                      title={lesson.isHidden ? "إظهار الحصة" : "إخفاء الحصة"}
                    >
                      {lesson.isHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                    <button 
                      onClick={() => handleDeleteLesson(lesson.id)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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

      {editingLessonId && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={closeEditLesson}>
          <div className="neon-card p-6 rounded-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">تعديل الحصة</h2>
              <button onClick={closeEditLesson} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditLesson} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-300">عنوان الدرس</label>
                <input type="text" required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="neon-input w-full px-4 py-2 rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-300">الصف الدراسي</label>
                <select value={editGrade} onChange={(e) => setEditGrade(e.target.value)} className="neon-input w-full px-4 py-2 rounded-xl">
                  <option value="2nd_sec">الثاني الثانوي</option>
                  <option value="3rd_sec">الثالث الثانوي</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-300">المنصة</label>
                <select value={editPlatform} onChange={(e) => setEditPlatform(e.target.value)} className="neon-input w-full px-4 py-2 rounded-xl">
                  <option value="youtube">YouTube</option>
                  <option value="vimeo">Vimeo</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-300">الرابط أو الـ ID</label>
                <input type="text" required value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className="neon-input w-full px-4 py-2 rounded-xl" dir="ltr" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={savingEdit} className="neon-btn flex-1 px-4 py-2.5 rounded-xl font-semibold disabled:opacity-50">
                  {savingEdit ? 'جاري الحفظ...' : 'حفظ التعديل'}
                </button>
                <button type="button" onClick={closeEditLesson} className="px-4 py-2.5 rounded-xl font-semibold bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
