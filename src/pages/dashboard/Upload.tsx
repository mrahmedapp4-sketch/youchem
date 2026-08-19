import { useState, useEffect, FormEvent } from 'react';
import { Video, Trash2, Eye, EyeOff, Plus, Pencil, X, Scissors } from 'lucide-react';
import { BunnyVideo } from '../../components/BunnyVideo';

export function UploadVideo() {
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showLessonForm, setShowLessonForm] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonGrade, setLessonGrade] = useState('2nd_sec');
  const [lessonPlatform, setLessonPlatform] = useState('youtube');
  const [lessonUrl, setLessonUrl] = useState('');

  const [previewLesson, setPreviewLesson] = useState<any>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editGrade, setEditGrade] = useState('2nd_sec');
  const [editPlatform, setEditPlatform] = useState('youtube');
  const [editUrl, setEditUrl] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [trimmingLesson, setTrimmingLesson] = useState<any>(null);
  const [trimFrom, setTrimFrom] = useState('13');
  const [trimTo, setTrimTo] = useState('63');
  const [savingTrim, setSavingTrim] = useState(false);

  useEffect(() => { fetchLessons(); }, []);

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/youchem/lessons');
      if (res.ok) setLessons(await res.json());
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleAddLesson = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/youchem/lessons', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: lessonTitle, gradeLevel: lessonGrade, platform: lessonPlatform, videoUrl: lessonUrl }),
      });
      if (res.ok) { setLessonTitle(''); setLessonUrl(''); setShowLessonForm(false); fetchLessons(); }
    } catch { alert('في مشكلة في إضافة الحصة'); }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('متأكد إنك تمسح الحصة دي؟')) return;
    try {
      const res = await fetch(`/api/youchem/lessons/${id}`, { method: 'DELETE' });
      if (res.ok) fetchLessons();
    } catch { alert('فشل المسح'); }
  };

  const openEditLesson = (lesson: any) => {
    setEditingLessonId(lesson.id); setEditTitle(lesson.title);
    setEditGrade(lesson.gradeLevel); setEditPlatform(lesson.platform); setEditUrl(lesson.videoUrl);
  };

  const handleSaveEditLesson = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingLessonId) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/youchem/lessons/${editingLessonId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, gradeLevel: editGrade, platform: editPlatform, videoUrl: editUrl }),
      });
      if (res.ok) { setEditingLessonId(null); fetchLessons(); }
      else alert('في مشكلة في حفظ التعديل');
    } catch { alert('في مشكلة في حفظ التعديل'); }
    setSavingEdit(false);
  };

  const handleToggleVisibility = async (id: string) => {
    try {
      const res = await fetch(`/api/youchem/lessons/${id}/toggle-visibility`, { method: 'PATCH' });
      if (res.ok) fetchLessons();
    } catch { alert('فشل في التعديل'); }
  };

  const openTrim = (lesson: any) => {
    setTrimmingLesson(lesson);
    setTrimFrom(String(lesson.skipFromSeconds ?? (lesson.videoUrl.includes('/712182/9d022807-a8d3-4d21-a6a6-59d2b79b283e') ? 13 : '')));
    setTrimTo(String(lesson.skipToSeconds ?? (lesson.videoUrl.includes('/712182/9d022807-a8d3-4d21-a6a6-59d2b79b283e') ? 63 : '')));
  };

  const handleSaveTrim = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmingLesson) return;
    const from = Number(trimFrom);
    const to = Number(trimTo);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to <= from) {
      alert('اكتب وقت بداية ونهاية صحيحين');
      return;
    }
    setSavingTrim(true);
    try {
      const res = await fetch(`/api/youchem/lessons/${trimmingLesson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipFromSeconds: from, skipToSeconds: to }),
      });
      if (res.ok) {
        setTrimmingLesson(null);
        fetchLessons();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'في مشكلة في حفظ القص');
      }
    } catch {
      alert('في مشكلة في حفظ القص');
    } finally {
      setSavingTrim(false);
    }
  };

  const handleClearTrim = async () => {
    if (!trimmingLesson) return;
    setSavingTrim(true);
    try {
      const res = await fetch(`/api/youchem/lessons/${trimmingLesson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipFromSeconds: null, skipToSeconds: null }),
      });
      if (res.ok) {
        setTrimmingLesson(null);
        fetchLessons();
      }
    } finally {
      setSavingTrim(false);
    }
  };

  const extractYoutubeId = (url: string) => {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
    return m ? m[1] : url;
  };

  const getEmbedUrl = (platform: string, videoUrl: string) => {
    if (platform === 'youtube') return `https://www.youtube.com/embed/${extractYoutubeId(videoUrl)}?autoplay=1`;
    if (platform === 'vimeo')   return `https://player.vimeo.com/video/${videoUrl}?autoplay=1`;
    if (platform === 'bunny')   return videoUrl;
    return videoUrl;
  };

  const SELECT_CLS = 'neon-input w-full px-3 py-2 rounded-xl text-sm';
  const INPUT_CLS  = 'neon-input w-full px-3 py-2 rounded-xl text-sm';
  const LABEL_CLS  = 'block text-xs font-semibold mb-1 text-slate-600';

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">إدارة الحصص</h1>
          <p className="text-slate-500 text-sm mt-0.5">إضافة وإدارة فيديوهات الدروس</p>
        </div>
        <button onClick={() => setShowLessonForm(!showLessonForm)} className="neon-btn px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          ضيف حصة جديدة
        </button>
      </div>

      {/* Add form */}
      {showLessonForm && (
        <div className="neon-card p-6 rounded-2xl">
          <h2 className="text-sm font-bold text-slate-800 mb-4">ضيف حصة جديدة</h2>
          <form onSubmit={handleAddLesson} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div><label className={LABEL_CLS}>الصف الدراسي</label>
              <select value={lessonGrade} onChange={e => setLessonGrade(e.target.value)} className={SELECT_CLS}>
                <option value="2nd_sec">تاني ثانوي</option>
                <option value="3rd_sec">تالت ثانوي</option>
              </select>
            </div>
            <div><label className={LABEL_CLS}>اسم الحصة</label>
              <input type="text" required value={lessonTitle} onChange={e => setLessonTitle(e.target.value)} className={INPUT_CLS} />
            </div>
            <div><label className={LABEL_CLS}>المنصة</label>
              <select value={lessonPlatform} onChange={e => setLessonPlatform(e.target.value)} className={SELECT_CLS}>
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo</option>
                <option value="bunny">Bunny</option>
              </select>
            </div>
            <div><label className={LABEL_CLS}>الرابط أو الـ ID</label>
              <input type="text" required value={lessonUrl} onChange={e => setLessonUrl(e.target.value)} className={INPUT_CLS} dir="ltr" />
            </div>
            <div>
              <button type="submit" className="neon-btn w-full py-2.5 rounded-xl font-semibold text-sm">حفظ</button>
            </div>
          </form>
        </div>
      )}

      {/* Lessons list */}
      {loading ? (
        <div className="text-center p-10 text-slate-400">بيتحمل...</div>
      ) : (
        <div className="neon-card rounded-2xl overflow-hidden">
          <div className="divide-y divide-slate-100">
            {lessons.length === 0 ? (
              <div className="p-10 text-slate-400 text-center text-sm">مفيش حصص مضافة لحد دلوقتي.</div>
            ) : lessons.map((lesson: any) => (
              <div key={lesson.id} className={`px-5 py-4 flex items-center justify-between transition-colors hover:bg-slate-50 ${lesson.isHidden ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`p-2.5 rounded-xl shrink-0 ${lesson.platform === 'youtube' ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                    <Video className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                      {lesson.title}
                      {lesson.isHidden && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-medium">مخفي</span>}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{lesson.gradeLevel === '2nd_sec' ? 'تاني ثانوي' : 'تالت ثانوي'}</span>
                      <span className="text-slate-200">·</span>
                      <span className="text-xs text-slate-400 uppercase">{lesson.platform}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setPreviewLesson(lesson)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="مشاهدة الفيديو">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => openTrim(lesson)} className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="قص جزء من الفيديو">
                    <Scissors className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEditLesson(lesson)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="تعديل">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleToggleVisibility(lesson.id)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title={lesson.isHidden ? 'إظهار' : 'إخفاء'}>
                    {lesson.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleDeleteLesson(lesson.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="حذف">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video preview modal */}
      {previewLesson && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewLesson(null)}
        >
          <div
            className="w-full max-w-4xl bg-black rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900">
              <span className="text-white font-bold text-sm truncate">{previewLesson.title}</span>
              <button
                onClick={() => setPreviewLesson(null)}
                className="text-slate-400 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video w-full">
              {previewLesson.platform === 'bunny' ? (
                <BunnyVideo
                  videoUrl={previewLesson.videoUrl}
                  title={previewLesson.title}
                  skipFromSeconds={previewLesson.skipFromSeconds}
                  skipToSeconds={previewLesson.skipToSeconds}
                  className="w-full h-full"
                />
              ) : (
                <iframe
                  src={getEmbedUrl(previewLesson.platform, previewLesson.videoUrl)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={previewLesson.title}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingLessonId && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setEditingLessonId(null)}>
          <div className="neon-card p-6 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-900">تعديل الحصة</h2>
              <button onClick={() => setEditingLessonId(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditLesson} className="space-y-4">
              {[
                { label: 'اسم الحصة', el: <input type="text" required value={editTitle} onChange={e => setEditTitle(e.target.value)} className={INPUT_CLS} /> },
                { label: 'الصف الدراسي', el: (
                  <select value={editGrade} onChange={e => setEditGrade(e.target.value)} className={SELECT_CLS}>
                    <option value="2nd_sec">تاني ثانوي</option><option value="3rd_sec">تالت ثانوي</option>
                  </select>
                )},
                { label: 'المنصة', el: (
                  <select value={editPlatform} onChange={e => setEditPlatform(e.target.value)} className={SELECT_CLS}>
                    <option value="youtube">YouTube</option><option value="vimeo">Vimeo</option><option value="bunny">Bunny</option>
                  </select>
                )},
                { label: 'الرابط أو الـ ID', el: <input type="text" required value={editUrl} onChange={e => setEditUrl(e.target.value)} className={INPUT_CLS} dir="ltr" /> },
              ].map(({ label, el }) => (
                <div key={label}><label className={LABEL_CLS}>{label}</label>{el}</div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={savingEdit} className="neon-btn flex-1 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50">
                  {savingEdit ? 'بيتحفظ...' : 'احفظ التعديل'}
                </button>
                <button type="button" onClick={() => setEditingLessonId(null)} className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
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
