import { useState, useEffect, FormEvent } from 'react';
import {
  Video,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  Pencil,
  X,
  Scissors,
  Image as ImageIcon,
  Upload,
  Loader2,
} from 'lucide-react';
import { BunnyVideo } from '../../components/BunnyVideo';
import { getLessonThumbnailUrl, getYouTubeThumbnailUrl } from '../../lib/videoThumbnail';

export function UploadVideo() {
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showLessonForm, setShowLessonForm] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonGrade, setLessonGrade] = useState('2nd_sec');
  const [lessonPlatform, setLessonPlatform] = useState('youtube');
  const [lessonUrl, setLessonUrl] = useState('');
  const [lessonThumbnailUrl, setLessonThumbnailUrl] = useState('');
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const [previewLesson, setPreviewLesson] = useState<any>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editGrade, setEditGrade] = useState('2nd_sec');
  const [editPlatform, setEditPlatform] = useState('youtube');
  const [editUrl, setEditUrl] = useState('');
  const [editThumbnailUrl, setEditThumbnailUrl] = useState('');
  const [uploadingEditThumbnail, setUploadingEditThumbnail] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [trimmingLesson, setTrimmingLesson] = useState<any>(null);
  const [trimFrom, setTrimFrom] = useState('12');
  const [trimTo, setTrimTo] = useState('60');
  const [savingTrim, setSavingTrim] = useState(false);

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/youchem/lessons');
      if (res.ok) setLessons(await res.json());
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleUploadThumbnail = async (file: File, isEdit: boolean) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('من فضلك اختر ملف صورة صالح (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، الحد الأقصى 10 ميجابايت');
      return;
    }

    if (isEdit) setUploadingEditThumbnail(true);
    else setUploadingThumbnail(true);

    try {
      const formData = new FormData();
      formData.append('thumbnail', file);
      const res = await fetch('/api/youchem/lessons/thumbnail', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (isEdit) {
          setEditThumbnailUrl(data.url);
        } else {
          setLessonThumbnailUrl(data.url);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'فشل في رفع الصورة');
      }
    } catch {
      alert('حدث خطأ أثناء رفع الصورة');
    } finally {
      if (isEdit) setUploadingEditThumbnail(false);
      else setUploadingThumbnail(false);
    }
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
          videoUrl: lessonUrl,
          thumbnailUrl: lessonThumbnailUrl.trim() || null,
        }),
      });
      if (res.ok) {
        setLessonTitle('');
        setLessonUrl('');
        setLessonThumbnailUrl('');
        setShowLessonForm(false);
        fetchLessons();
      }
    } catch {
      alert('في مشكلة في إضافة الحصة');
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('متأكد إنك تمسح الحصة دي؟')) return;
    try {
      const res = await fetch(`/api/youchem/lessons/${id}`, { method: 'DELETE' });
      if (res.ok) fetchLessons();
    } catch {
      alert('فشل المسح');
    }
  };

  const openEditLesson = (lesson: any) => {
    setEditingLessonId(lesson.id);
    setEditTitle(lesson.title);
    setEditGrade(lesson.gradeLevel);
    setEditPlatform(lesson.platform);
    setEditUrl(lesson.videoUrl);
    setEditThumbnailUrl(lesson.thumbnailUrl || '');
  };

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
          thumbnailUrl: editThumbnailUrl.trim() || null,
        }),
      });
      if (res.ok) {
        setEditingLessonId(null);
        fetchLessons();
      } else {
        alert('في مشكلة في حفظ التعديل');
      }
    } catch {
      alert('في مشكلة في حفظ التعديل');
    }
    setSavingEdit(false);
  };

  const handleToggleVisibility = async (id: string) => {
    try {
      const res = await fetch(`/api/youchem/lessons/${id}/toggle-visibility`, { method: 'PATCH' });
      if (res.ok) fetchLessons();
    } catch {
      alert('فشل في التعديل');
    }
  };

  const openTrim = (lesson: any) => {
    setTrimmingLesson(lesson);
    setTrimFrom(
      String(
        lesson.skipFromSeconds ??
          (lesson.videoUrl.includes('/712182/9d022807-a8d3-4d21-a6a6-59d2b79b283e') ? 12 : ''),
      ),
    );
    setTrimTo(
      String(
        lesson.skipToSeconds ??
          (lesson.videoUrl.includes('/712182/9d022807-a8d3-4d21-a6a6-59d2b79b283e') ? 60 : ''),
      ),
    );
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
    if (platform === 'vimeo') return `https://player.vimeo.com/video/${videoUrl}?autoplay=1`;
    if (platform === 'bunny') return videoUrl;
    return videoUrl;
  };

  const SELECT_CLS = 'neon-input w-full px-3 py-2 rounded-xl text-sm';
  const INPUT_CLS = 'neon-input w-full px-3 py-2 rounded-xl text-sm';
  const LABEL_CLS = 'block text-xs font-semibold mb-1 text-slate-600';

  const previewAddThumbnail =
    lessonThumbnailUrl.trim() ||
    (lessonPlatform === 'youtube' ? getYouTubeThumbnailUrl(lessonPlatform, lessonUrl) : null);

  const previewEditThumbnail =
    editThumbnailUrl.trim() ||
    (editPlatform === 'youtube' ? getYouTubeThumbnailUrl(editPlatform, editUrl) : null);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">إدارة الحصص</h1>
          <p className="text-slate-500 text-sm mt-0.5">إضافة وإدارة فيديوهات الدروس والصور المصغرة</p>
        </div>
        <button
          onClick={() => setShowLessonForm(!showLessonForm)}
          className="neon-btn px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          ضيف حصة جديدة
        </button>
      </div>

      {/* Add form */}
      {showLessonForm && (
        <div className="neon-card p-6 rounded-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-800">ضيف حصة جديدة</h2>
            <button
              onClick={() => setShowLessonForm(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleAddLesson} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className={LABEL_CLS}>الصف الدراسي</label>
                <select value={lessonGrade} onChange={(e) => setLessonGrade(e.target.value)} className={SELECT_CLS}>
                  <option value="2nd_sec">تاني ثانوي</option>
                  <option value="3rd_sec">تالت ثانوي</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>اسم الحصة</label>
                <input
                  type="text"
                  required
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  className={INPUT_CLS}
                  placeholder="مثال: الباب الأول - الدرس الأول"
                />
              </div>
              <div>
                <label className={LABEL_CLS}>المنصة</label>
                <select value={lessonPlatform} onChange={(e) => setLessonPlatform(e.target.value)} className={SELECT_CLS}>
                  <option value="youtube">YouTube</option>
                  <option value="vimeo">Vimeo</option>
                  <option value="bunny">Bunny</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>الرابط أو الـ ID</label>
                <input
                  type="text"
                  required
                  value={lessonUrl}
                  onChange={(e) => setLessonUrl(e.target.value)}
                  className={INPUT_CLS}
                  dir="ltr"
                  placeholder="رابط أو معرف الفيديو"
                />
              </div>
            </div>

            {/* Thumbnail section */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  صورة الغلاف (Thumbnail) - تظهر عند الطلبة
                </label>
                {lessonThumbnailUrl && (
                  <button
                    type="button"
                    onClick={() => setLessonThumbnailUrl('')}
                    className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    إزالة الصورة المخصصة
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Preview Box */}
                <div className="relative w-36 sm:w-44 aspect-video rounded-xl overflow-hidden bg-slate-200 border border-slate-300/80 shrink-0 flex items-center justify-center shadow-inner">
                  {uploadingThumbnail ? (
                    <div className="flex flex-col items-center gap-1 text-indigo-600 text-xs">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>جاري الرفع...</span>
                    </div>
                  ) : previewAddThumbnail ? (
                    <img
                      src={previewAddThumbnail}
                      alt="Thumbnail preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-400 text-xs text-center p-2">
                      <ImageIcon className="w-6 h-6" />
                      <span>لا توجد صورة</span>
                    </div>
                  )}
                  {lessonThumbnailUrl && !uploadingThumbnail && (
                    <span className="absolute bottom-1 right-1 bg-black/70 text-[10px] text-white px-1.5 py-0.5 rounded">
                      مخصصة
                    </span>
                  )}
                </div>

                {/* Upload & Link options */}
                <div className="flex-1 w-full space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      className={`neon-btn px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                        uploadingThumbnail ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      {uploadingThumbnail ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span>رفع صورة من جهازك</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingThumbnail}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadThumbnail(file, false);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <span className="text-xs text-slate-400">أو اكتب رابط الصورة مباشرة:</span>
                  </div>

                  <input
                    type="text"
                    placeholder="https://example.com/thumbnail.jpg"
                    value={lessonThumbnailUrl}
                    onChange={(e) => setLessonThumbnailUrl(e.target.value)}
                    className={INPUT_CLS}
                    dir="ltr"
                  />

                  <p className="text-[11px] text-slate-500">
                    {lessonThumbnailUrl
                      ? '✓ تم تحديد صورة مصغرة مخصصة وستظهر للطلاب.'
                      : lessonPlatform === 'youtube'
                      ? 'ℹ️ إذا تركتها فارغة، ستظهر صورة غلاف يوتيوب التلقائية للطلبة.'
                      : '💡 يمكنك رفع صورة بوستر الحصة لتظهر للطلاب بدلاً من الرمز الافتراضي.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={uploadingThumbnail}
                className="neon-btn px-8 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
              >
                حفظ الحصة
              </button>
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
            ) : (
              lessons.map((lesson: any) => {
                const thumbnailUrl = getLessonThumbnailUrl(lesson);
                return (
                  <div
                    key={lesson.id}
                    className={`px-5 py-4 flex items-center justify-between transition-colors hover:bg-slate-50 ${
                      lesson.isHidden ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`relative w-20 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center ${
                          lesson.platform === 'youtube'
                            ? 'bg-red-50 text-red-500 border border-red-100'
                            : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                        }`}
                      >
                        <Video className="w-5 h-5" />
                        {thumbnailUrl && (
                          <img
                            src={thumbnailUrl}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                          {lesson.title}
                          {lesson.isHidden && (
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-medium">
                              مخفي
                            </span>
                          )}
                          {lesson.thumbnailUrl && (
                            <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md font-medium flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" />
                              صورة مخصصة
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400">
                            {lesson.gradeLevel === '2nd_sec' ? 'تاني ثانوي' : 'تالت ثانوي'}
                          </span>
                          <span className="text-slate-200">·</span>
                          <span className="text-xs text-slate-400 uppercase">{lesson.platform}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setPreviewLesson(lesson)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="مشاهدة الفيديو"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openTrim(lesson)}
                        className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                        title="قص جزء من الفيديو"
                      >
                        <Scissors className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditLesson(lesson)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="تعديل"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleVisibility(lesson.id)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title={lesson.isHidden ? 'إظهار' : 'إخفاء'}
                      >
                        {lesson.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteLesson(lesson.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
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
            onClick={(e) => e.stopPropagation()}
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

      {/* Trim modal */}
      {trimmingLesson && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setTrimmingLesson(null)}
        >
          <div className="neon-card p-6 rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-slate-900">قص جزء من الفيديو</h2>
              <button
                onClick={() => setTrimmingLesson(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-5 truncate">{trimmingLesson.title}</p>
            <form onSubmit={handleSaveTrim} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>من ثانية</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={trimFrom}
                    onChange={(e) => setTrimFrom(e.target.value)}
                    className={INPUT_CLS}
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>إلى ثانية</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={trimTo}
                    onChange={(e) => setTrimTo(e.target.value)}
                    className={INPUT_CLS}
                    dir="ltr"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                الفيديو سيبدأ من الثانية الأولى ويتخطى الجزء المحدد من {trimFrom || '—'} إلى {trimTo || '—'} عند تشغيله للطلاب.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingTrim}
                  className="neon-btn flex-1 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
                >
                  {savingTrim ? 'بيتحفظ...' : 'حفظ القص'}
                </button>
                <button
                  type="button"
                  onClick={handleClearTrim}
                  disabled={
                    savingTrim ||
                    (trimmingLesson.skipFromSeconds == null && trimmingLesson.skipToSeconds == null)
                  }
                  className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  مسح القص
                </button>
                <button
                  type="button"
                  onClick={() => setTrimmingLesson(null)}
                  className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingLessonId && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditingLessonId(null)}
        >
          <div className="neon-card p-6 rounded-2xl w-full max-w-xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-900">تعديل الحصة</h2>
              <button
                onClick={() => setEditingLessonId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditLesson} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={LABEL_CLS}>اسم الحصة</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>الصف الدراسي</label>
                  <select
                    value={editGrade}
                    onChange={(e) => setEditGrade(e.target.value)}
                    className={SELECT_CLS}
                  >
                    <option value="2nd_sec">تاني ثانوي</option>
                    <option value="3rd_sec">تالت ثانوي</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>المنصة</label>
                  <select
                    value={editPlatform}
                    onChange={(e) => setEditPlatform(e.target.value)}
                    className={SELECT_CLS}
                  >
                    <option value="youtube">YouTube</option>
                    <option value="vimeo">Vimeo</option>
                    <option value="bunny">Bunny</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL_CLS}>الرابط أو الـ ID</label>
                  <input
                    type="text"
                    required
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className={INPUT_CLS}
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Edit Thumbnail Section */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-indigo-600" />
                    صورة الغلاف (Thumbnail) - تظهر عند الطلبة
                  </label>
                  {editThumbnailUrl && (
                    <button
                      type="button"
                      onClick={() => setEditThumbnailUrl('')}
                      className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      إزالة الصورة المخصصة
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Preview Box */}
                  <div className="relative w-36 sm:w-44 aspect-video rounded-xl overflow-hidden bg-slate-200 border border-slate-300/80 shrink-0 flex items-center justify-center shadow-inner">
                    {uploadingEditThumbnail ? (
                      <div className="flex flex-col items-center gap-1 text-indigo-600 text-xs">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>جاري الرفع...</span>
                      </div>
                    ) : previewEditThumbnail ? (
                      <img
                        src={previewEditThumbnail}
                        alt="Thumbnail preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400 text-xs text-center p-2">
                        <ImageIcon className="w-6 h-6" />
                        <span>لا توجد صورة</span>
                      </div>
                    )}
                    {editThumbnailUrl && !uploadingEditThumbnail && (
                      <span className="absolute bottom-1 right-1 bg-black/70 text-[10px] text-white px-1.5 py-0.5 rounded">
                        مخصصة
                      </span>
                    )}
                  </div>

                  {/* Upload & Link options */}
                  <div className="flex-1 w-full space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        className={`neon-btn px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                          uploadingEditThumbnail ? 'opacity-50 pointer-events-none' : ''
                        }`}
                      >
                        {uploadingEditThumbnail ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>رفع صورة جديدة من جهازك</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingEditThumbnail}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadThumbnail(file, true);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <span className="text-xs text-slate-400">أو عدّل الرابط مباشرة:</span>
                    </div>

                    <input
                      type="text"
                      placeholder="https://example.com/thumbnail.jpg"
                      value={editThumbnailUrl}
                      onChange={(e) => setEditThumbnailUrl(e.target.value)}
                      className={INPUT_CLS}
                      dir="ltr"
                    />

                    <p className="text-[11px] text-slate-500">
                      {editThumbnailUrl
                        ? '✓ تم تحديد صورة مصغرة مخصصة للحصة.'
                        : editPlatform === 'youtube'
                        ? 'ℹ️ ستظهر صورة غلاف يوتيوب التلقائية للطلبة في حال عدم تحديد صورة مخصصة.'
                        : '💡 يمكنك رفع صورة بوستر الحصة لتظهر للطلاب.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingEdit || uploadingEditThumbnail}
                  className="neon-btn flex-1 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
                >
                  {savingEdit ? 'بيتحفظ...' : 'احفظ التعديل'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingLessonId(null)}
                  className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
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
