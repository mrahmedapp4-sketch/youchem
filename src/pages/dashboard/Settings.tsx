import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Users, BookOpen, FileText, FileQuestion, ShieldAlert, KeyRound, BarChart3, Trash2 } from 'lucide-react';

export function Settings() {
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Change password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Reset state
  const [resetInput, setResetInput] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetch('/api/youchem/settings/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setStatsLoading(false); })
      .catch(() => setStatsLoading(false));
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 4) return setPwMsg({ type: 'err', text: 'كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل' });
    if (newPw !== confirmPw) return setPwMsg({ type: 'err', text: 'كلمتا المرور غير متطابقتين' });
    setPwSaving(true);
    try {
      const res = await fetch('/api/teacher/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwMsg({ type: 'ok', text: 'تم تغيير كلمة المرور بنجاح ✓' });
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
      } else {
        setPwMsg({ type: 'err', text: data.error || 'فشل تغيير كلمة المرور' });
      }
    } catch {
      setPwMsg({ type: 'err', text: 'حدث خطأ في الاتصال' });
    }
    setPwSaving(false);
  };

  const handleReset = async () => {
    if (resetInput !== 'حذف') return;
    if (!confirm('هل أنت متأكد تماماً؟ سيتم حذف كل الحصص والاختبارات والواجبات وأكواد الوصول بشكل نهائي لا يمكن التراجع عنه.')) return;
    setResetting(true);
    try {
      const res = await fetch('/api/youchem/reset-platform', { method: 'POST' });
      if (res.ok) {
        alert('تم إعادة تعيين المنصة بنجاح. الحسابات محفوظة.');
        setResetInput('');
        // refresh stats
        fetch('/api/youchem/settings/stats').then(r => r.json()).then(setStats);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'فشلت عملية الإعادة');
      }
    } catch { alert('حدث خطأ'); }
    setResetting(false);
  };

  const statCards = stats ? [
    { label: 'الطلاب المسجلون', value: stats.students, icon: Users, color: 'indigo' },
    { label: 'الحصص', value: stats.lessons, icon: BookOpen, color: 'violet' },
    { label: 'الواجبات', value: stats.homeworks, icon: FileText, color: 'blue' },
    { label: 'الاختبارات', value: stats.quizzes, icon: FileQuestion, color: 'sky' },
  ] : [];

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-slate-500" />
          الإعدادات
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">إعدادات وأدوات إدارة المنصة</p>
      </div>

      {/* ── Stats ── */}
      <section className="space-y-3">
        <h2 className="font-bold text-slate-700 text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-400" />
          إحصائيات المنصة
        </h2>
        {statsLoading ? (
          <div className="text-slate-400 text-sm">جاري التحميل...</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {statCards.map(card => (
              <div key={card.label} className="neon-card p-5 rounded-2xl flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl bg-${card.color}-50 border border-${card.color}-100 flex items-center justify-center shrink-0`}>
                  <card.icon className={`w-5 h-5 text-${card.color}-600`} />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-slate-900">{card.value}</p>
                  <p className="text-xs text-slate-500">{card.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="neon-card p-4 rounded-2xl text-center">
              <p className="text-lg font-bold text-slate-800">{stats.codesUsed} / {stats.codesTotal}</p>
              <p className="text-xs text-slate-500">أكواد مستخدمة / إجمالي الأكواد</p>
            </div>
            <div className="neon-card p-4 rounded-2xl text-center">
              <p className="text-lg font-bold text-slate-800">{stats.homeworkSubmissions}</p>
              <p className="text-xs text-slate-500">تسليمات واجبات</p>
            </div>
          </div>
        )}
      </section>

      {/* ── Change Password ── */}
      <section className="space-y-3">
        <h2 className="font-bold text-slate-700 text-sm flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-slate-400" />
          تغيير كلمة مرور لوحة التحكم
        </h2>
        <form onSubmit={handleChangePassword} className="neon-card p-5 rounded-2xl space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">كلمة المرور الحالية</label>
            <input
              type="password" required value={currentPw} onChange={e => setCurrentPw(e.target.value)}
              className="neon-input w-full px-4 py-2.5 rounded-xl text-sm"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">كلمة المرور الجديدة</label>
            <input
              type="password" required value={newPw} onChange={e => setNewPw(e.target.value)}
              className="neon-input w-full px-4 py-2.5 rounded-xl text-sm"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">تأكيد كلمة المرور الجديدة</label>
            <input
              type="password" required value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
              className="neon-input w-full px-4 py-2.5 rounded-xl text-sm"
              placeholder="••••••••"
            />
          </div>
          {pwMsg && (
            <p className={`text-sm font-semibold ${pwMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
              {pwMsg.text}
            </p>
          )}
          <button type="submit" disabled={pwSaving} className="neon-btn w-full py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">
            {pwSaving ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
          </button>
        </form>
      </section>

      {/* ── Danger Zone ── */}
      <section className="space-y-3">
        <h2 className="font-bold text-red-600 text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          منطقة الخطر
        </h2>
        <div className="border-2 border-red-200 rounded-2xl p-5 bg-red-50/40 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-red-700">إعادة تعيين المنصة</h3>
              <p className="text-red-600/80 text-sm mt-0.5 leading-relaxed">
                يحذف هذا الإجراء بشكل <strong>نهائي</strong> كل الحصص، الاختبارات، الواجبات، أكواد الوصول، وتسليمات الطلاب.
                <br />
                <strong>الحسابات (أسماء الطلاب وبريدهم) تظل محفوظة.</strong>
              </p>
            </div>
          </div>

          <div className="border-t border-red-200 pt-4 space-y-3">
            <label className="block text-sm font-semibold text-red-700">
              اكتب <span className="font-extrabold bg-red-100 px-1.5 py-0.5 rounded">حذف</span> للتأكيد
            </label>
            <input
              type="text"
              value={resetInput}
              onChange={e => setResetInput(e.target.value)}
              placeholder="حذف"
              className="w-full px-4 py-2.5 rounded-xl border-2 border-red-200 bg-white text-sm focus:outline-none focus:border-red-400"
              dir="rtl"
            />
            <button
              onClick={handleReset}
              disabled={resetInput !== 'حذف' || resetting}
              className="w-full py-2.5 rounded-xl font-bold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {resetting ? 'جاري الحذف...' : 'إعادة تعيين المنصة'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
