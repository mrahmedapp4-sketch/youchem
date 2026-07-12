import { useState, useEffect, FormEvent } from 'react';
import * as tus from 'tus-js-client';
import { UploadCloud, CheckCircle, Video } from 'lucide-react';

export function TeacherDashboard() {
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState('2nd_sec');
  const [videoType, setVideoType] = useState('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [approvals, setApprovals] = useState<any[]>([]);

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    const res = await fetch('/api/teacher/approvals');
    if (res.ok) {
      setApprovals(await res.json());
    }
  };

  const handleApprove = async (id: string) => {
    await fetch(`/api/teacher/approvals/${id}/approve`, { method: 'POST' });
    fetchApprovals();
  };

  const handleSaveLesson = async (e: FormEvent) => {
    e.preventDefault();
    if (videoType === 'youtube') {
      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, grade, videoType, videoUrlOrId: youtubeUrl })
      });
      if (res.ok) {
        alert('تمت إضافة الدرس بنجاح');
        setTitle('');
        setYoutubeUrl('');
      }
    } else {
      if (!videoFile) return alert('يرجى اختيار ملف الفيديو');
      setIsUploading(true);

      try {
        // Init Vimeo upload
        const initRes = await fetch('/api/vimeo/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filesize: videoFile.size })
        });
        const initData = await initRes.json();
        
        if (!initData.upload_link) throw new Error('Failed to init upload');

        // Start TUS upload
        const upload = new tus.Upload(videoFile, {
          uploadUrl: initData.upload_link,
          onError: function (error) {
            console.log("Failed because: " + error);
            alert('فشل الرفع');
            setIsUploading(false);
          },
          onProgress: function (bytesUploaded, bytesTotal) {
            const percentage = (bytesUploaded / bytesTotal * 100).toFixed(2);
            setUploadProgress(Number(percentage));
          },
          onSuccess: async function () {
            // Save lesson to DB
            await fetch('/api/lessons', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title, grade, videoType: 'vimeo', videoUrlOrId: initData.vimeo_id })
            });
            alert('تم الرفع وإضافة الدرس بنجاح');
            setIsUploading(false);
            setUploadProgress(0);
            setTitle('');
            setVideoFile(null);
          }
        });

        // Check if there are any previous uploads to continue.
        upload.findPreviousUploads().then(function (previousUploads) {
          if (previousUploads.length) {
            upload.resumeFromPreviousUpload(previousUploads[0]);
          }
          upload.start();
        });
      } catch (err) {
        alert('حدث خطأ في الرفع');
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900">لوحة تحكم المدرس</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Video className="w-5 h-5 text-blue-600" />
            إضافة درس جديد
          </h2>
          <form onSubmit={handleSaveLesson} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">عنوان الدرس</label>
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الصف</label>
              <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full p-2 border rounded-lg">
                <option value="2nd_sec">الثاني الثانوي</option>
                <option value="3rd_sec">الثالث الثانوي</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">نوع الفيديو</label>
              <select value={videoType} onChange={e => setVideoType(e.target.value)} className="w-full p-2 border rounded-lg">
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo Upload</option>
              </select>
            </div>

            {videoType === 'youtube' ? (
              <div>
                <label className="block text-sm font-medium mb-1">رابط يوتيوب</label>
                <input type="url" required value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} className="w-full p-2 border rounded-lg text-left" dir="ltr" />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1">ملف الفيديو</label>
                <input type="file" accept="video/*" required onChange={e => setVideoFile(e.target.files?.[0] || null)} className="w-full p-2 border rounded-lg" />
                
                {isUploading && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>جاري الرفع...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                      <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button disabled={isUploading} type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <UploadCloud className="w-5 h-5" />
              حفظ الدرس
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            طلبات الموافقة المعلقة
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-3 font-semibold">الطالب</th>
                  <th className="p-3 font-semibold">الدرس</th>
                  <th className="p-3 font-semibold">الدرجة</th>
                  <th className="p-3 font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {approvals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-500">لا توجد طلبات معلقة</td>
                  </tr>
                ) : (
                  approvals.map(app => (
                    <tr key={app.id} className="border-b last:border-0">
                      <td className="p-3">{app.studentName}</td>
                      <td className="p-3">{app.lessonTitle}</td>
                      <td className="p-3 text-red-600 font-bold">{app.score}/10</td>
                      <td className="p-3">
                        <button onClick={() => handleApprove(app.id)} className="bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 font-medium">
                          موافقة ونجاح
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
