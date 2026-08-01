import { useState, useEffect, useRef, FormEvent } from 'react';
import { Trash2, Plus, X, Download, Upload } from 'lucide-react';

const GRADE_LABELS: Record<string, string> = {
  '2nd_sec': 'تاني ثانوي',
  '3rd_sec': 'تالت ثانوي',
  'all': 'كل الصفوف',
};

export function TeacherFiles() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [gradeLevel, setGradeLevel] = useState('all');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchFiles(); }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/youchem/files');
      if (res.ok) setFiles(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle('');
    setGradeLevel('all');
    setSelectedFile(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedFile) { setError('اختار ملف أولاً'); return; }
    if (!title.trim()) { setError('حط عنوان للملف'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('title', title.trim());
      fd.append('gradeLevel', gradeLevel);
      const res = await fetch('/api/youchem/files', { method: 'POST', body: fd });
      if (res.ok) {
        resetForm();
        setShowForm(false);
        fetchFiles();
      } else {
        const data = await res.json();
        setError(data.error || 'في مشكلة في الرفع');
      }
    } catch {
      setError('في مشكلة في الاتصال');
    }
    setUploading(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`متأكد إنك تمسح "${name}"؟`)) return;
    try {
      const res = await fetch(`/api/youchem/files/${id}`, { method: 'DELETE' });
      if (res.ok) fetchFiles();
      else alert('في مشكلة في المسح');
    } catch { alert('في مشكلة في الاتصال'); }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">الملفات</h1>
          <p className="text-slate-500 text-sm mt-1">ارفع ملفات للطلاب يحملوها</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="neon-btn flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm"
        >
          <Plus className="w-4 h-4" />
          رفع ملف جديد
        </button>
      </div>

      {/* Upload form */}
      {showForm && (
        <div className="neon-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-slate-900">رفع ملف جديد</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-slate-700">عنوان الملف</label>
              <input
                type="text" required
                className="neon-input w-full px-3 py-2.5 rounded-xl text-sm"
                placeholder="مثال: مراجعة الباب الأول"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-slate-700">الصف الدراسي</label>
              <select
                className="neon-input w-full px-3 py-2.5 rounded-xl text-sm"
                value={gradeLevel}
                onChange={e => setGradeLevel(e.target.value)}
              >
                <option value="all">كل الصفوف</option>
                <option value="2nd_sec">تاني ثانوي</option>
                <option value="3rd_sec">تالت ثانوي</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-slate-700">الملف</label>
              <div
                className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <img src="/folder-icon.png" alt="ملف" className="w-12 h-12 mx-auto mb-2 opacity-60" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                {selectedFile ? (
                  <p className="text-sm font-semibold text-indigo-700">{selectedFile.name}</p>
                ) : (
                  <p className="text-sm text-slate-400">اضغط لاختيار الملف (حتى 50 MB)</p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm font-semibold text-center">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="neon-btn flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
              >
                {uploading ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />بيترفع...</>
                ) : (
                  <><Upload className="w-4 h-4" />ارفع الملف</>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Files list */}
      {loading ? (
        <div className="text-center p-12 text-slate-400">بيتحمل...</div>
      ) : files.length === 0 ? (
        <div className="neon-card rounded-2xl p-12 text-center text-slate-400">
          <img src="/folder-icon.png" alt="ملفات" className="w-16 h-16 mx-auto mb-3 opacity-40" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
          <p className="font-semibold">مفيش ملفات لحد دلوقتي</p>
          <p className="text-sm mt-1">ارفع أول ملف للطلاب</p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((f: any) => (
            <div key={f.id} className="neon-card rounded-2xl p-4 flex items-center gap-4">
              <img src="/folder-icon.png" alt="ملف" className="w-10 h-10 object-contain shrink-0" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 truncate">{f.title}</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {f.fileName}
                  {f.fileSize ? ` · ${formatSize(f.fileSize)}` : ''}
                  {' · '}{GRADE_LABELS[f.gradeLevel] ?? f.gradeLevel}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={f.fileUrl}
                  download={f.fileName}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  حمّل
                </a>
                <button
                  onClick={() => handleDelete(f.id, f.title)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  مسح
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
