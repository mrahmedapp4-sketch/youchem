import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, CheckCircle } from 'lucide-react';

export function Codes() {
  const [count, setCount] = useState(50);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState('');
  
  const [codesList, setCodesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/youchem/codes');
      if (res.ok) {
        const data = await res.json();
        // Sort newest first
        data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCodesList(data);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedMessage('');
    try {
      const res = await fetch('/api/youchem/codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedMessage(`تم إنشاء ${data.generated} كود بنجاح.`);
        fetchCodes(); // Refresh list
      }
    } catch (e) {
      alert('حدث خطأ أثناء الإنشاء');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBurnCode = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الكود نهائياً؟')) return;
    try {
      const res = await fetch(`/api/youchem/codes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCodesList(codesList.filter(c => c.id !== id));
      }
    } catch (err) {
      alert('فشل في حذف الكود');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">إدارة الأكواد</h1>
          <p className="text-slate-500 mt-1">توليد وإدارة أكواد الوصول للطلاب</p>
        </div>
        
        <div className="flex items-center gap-3">
          <input 
            type="number" 
            value={count} 
            onChange={(e) => setCount(Number(e.target.value))}
            min="1" max="500"
            className="w-24 px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? (
               <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
               <Plus className="w-5 h-5" />
            )}
            توليد
          </button>
        </div>
      </div>
      
      {generatedMessage && (
        <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 border border-emerald-100">
          <CheckCircle className="w-5 h-5" />
          <span className="font-semibold">{generatedMessage}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">جاري التحميل...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="p-4 font-semibold">الكود</th>
                  <th className="p-4 font-semibold">الحالة</th>
                  <th className="p-4 font-semibold">الطالب (User ID)</th>
                  <th className="p-4 font-semibold">تاريخ التوليد</th>
                  <th className="p-4 font-semibold text-center w-24">حذف (Burn)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {codesList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">لا توجد أكواد مولدة.</td>
                  </tr>
                )}
                {codesList.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-mono text-slate-900 font-medium">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-slate-400" />
                        {c.codeString}
                      </div>
                    </td>
                    <td className="p-4">
                      {c.isUsed ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 text-sm font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                          مستخدم
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          متاح
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 text-sm font-mono truncate max-w-[150px]">
                      {c.usedBy || '-'}
                    </td>
                    <td className="p-4 text-slate-500 text-sm">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <button 
                        onClick={() => handleBurnCode(c.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors w-full flex justify-center"
                        title="حذف نهائي"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
