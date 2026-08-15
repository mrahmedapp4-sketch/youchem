import { useState, useEffect, type FormEvent } from 'react';
import { Settings as SettingsIcon, Users, BookOpen, FileText, FileQuestion, ShieldAlert, KeyRound, BarChart3, Trash2, HardDrive, Terminal, Copy, RefreshCw, Eye, EyeOff } from 'lucide-react';

export function Settings() {
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Change password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // API key state
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyGenerating, setApiKeyGenerating] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  // Files storage limit state
  const [filesUsage, setFilesUsage] = useState<{ usedMB: number; limitMB: number; remainingMB: number } | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [limitSaving, setLimitSaving] = useState(false);
  const [limitMsg, setLimitMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Reset state
  const [resetInput, setResetInput] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetch('/api/youchem/settings/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setStatsLoading(false); })
      .catch(() => setStatsLoading(false));
    fetch('/api/youchem/files/usage')
      .then(r => r.json())
      .then(d => { setFilesUsage(d); setLimitInput(String(d.limitMB)); })
      .catch(() => {});

    fetch('/api/youchem/settings/api-key')
      .then(r => r.json())
      .then(d => setApiKey(d.apiKey ?? null))
      .catch(() => {});
  }, []);

  const handleGenerateApiKey = async () => {
    setApiKeyGenerating(true);
    try {
      const res = await fetch('/api/youchem/settings/api-key/generate', { method: 'POST' });
      const data = await res.json();
      if (res.ok) setApiKey(data.apiKey);
    } catch {}
    setApiKeyGenerating(false);
  };

  const handleCopyApiKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey).then(() => {
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 2000);
    });
  };

  const handleSaveLimit = async (e: FormEvent) => {
    e.preventDefault();
    setLimitMsg(null);
    setLimitSaving(true);
    try {
      const res = await fetch('/api/youchem/settings/files-limit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limitMB: limitInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setLimitMsg({ type: 'ok', text: `تم تحديد الحد بـ ${data.limitMB} MB ✓` });
        setFilesUsage(prev => prev ? { ...prev, limitMB: data.limitMB, remainingMB: Math.max(0, data.limitMB - prev.usedMB) } : prev);
      } else {
        setLimitMsg({ type: 'err', text: data.error || 'في مشكلة' });
      }
    } catch {
      setLimitMsg({ type: 'err', text: 'في مشكلة في الاتصال' });
    }
    setLimitSaving(false);
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 4) return setPwMsg({ type: 'err', text: 'كلمة السر الجديدة لازم تكون 4 حروف على الأقل' });
    if (newPw !== confirmPw) return setPwMsg({ type: 'err', text: 'كلمتين السر مش متطابقتين' });
    setPwSaving(true);
    try {
      const res = await fetch('/api/teacher/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwMsg({ type: 'ok', text: 'اتغيرت كلمة السر بنجاح ✓' });
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
      } else {
        setPwMsg({ type: 'err', text: data.error || 'فشل تغيير كلمة السر' });
      }
    } catch {
      setPwMsg({ type: 'err', text: 'في مشكلة في الاتصال' });
    }
    setPwSaving(false);
  };

  const handleReset = async () => {
    if (resetInput !== 'حذف') return;
    if (!confirm('متأكد تماماً؟ هيتمسح كل الحصص والامتحانات والواجبات والأكواد بشكل نهائي مش هيتراجع.')) return;
    setResetting(true);
    try {
      const res = await fetch('/api/youchem/reset-platform', { method: 'POST' });
      if (res.ok) {
        alert('اتعملت إعادة ضبط للمنصة بنجاح. الحسابات موجودة.');
        setResetInput('');
        // refresh stats
        fetch('/api/youchem/settings/stats').then(r => r.json()).then(setStats);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'فشلت عملية الإعادة');
      }
    } catch { alert('في مشكلة'); }
    setResetting(false);
  };

  const statCards = stats ? [
    { label: 'الطلاب المسجلين', value: stats.students, icon: Users, color: 'indigo' },
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
        <p className="text-slate-500 text-sm mt-0.5">إعدادات وأدوات المنصة</p>
      </div>

      {/* ── Stats ── */}
      <section className="space-y-3">
        <h2 className="font-bold text-slate-700 text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-400" />
          إحصائيات المنصة
        </h2>
        {statsLoading ? (
          <div className="text-slate-400 text-sm">بيتحمل...</div>
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

      {/* ── API Key ── */}
      <section className="space-y-3">
        <h2 className="font-bold text-slate-700 text-sm flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-400" />
          API Key (Python Dashboard)
        </h2>
        <div className="neon-card p-5 rounded-2xl space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Use this key to authenticate the <code className="bg-slate-100 px-1 rounded text-indigo-600">students_gui.py</code> script from your machine.
            <br />
            Run: <code className="bg-slate-100 px-1 rounded text-indigo-600">python3 students_gui.py --url https://youchem.up.railway.app --key YOUR_KEY</code>
          </p>

          {apiKey ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 overflow-hidden text-ellipsis whitespace-nowrap">
                {apiKeyVisible ? apiKey : '•'.repeat(24)}
              </div>
              <button
                onClick={() => setApiKeyVisible(v => !v)}
                className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors shrink-0"
                title={apiKeyVisible ? 'Hide' : 'Show'}
              >
                {apiKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={handleCopyApiKey}
                className={`p-2.5 rounded-xl border transition-colors shrink-0 ${apiKeyCopied ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-slate-200 hover:bg-slate-50 text-slate-500'}`}
                title="Copy"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={handleGenerateApiKey}
                disabled={apiKeyGenerating}
                className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors shrink-0 disabled:opacity-50"
                title="Regenerate"
              >
                <RefreshCw className={`w-4 h-4 ${apiKeyGenerating ? 'animate-spin' : ''}`} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateApiKey}
              disabled={apiKeyGenerating}
              className="neon-btn w-full py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Terminal className="w-4 h-4" />
              {apiKeyGenerating ? 'Generating...' : 'Generate API Key'}
            </button>
          )}

          {apiKeyCopied && (
            <p className="text-xs text-emerald-600 font-semibold">Copied to clipboard ✓</p>
          )}
        </div>
      </section>

      {/* ── Storage Limit ── */}
      <section className="space-y-3">
        <h2 className="font-bold text-slate-700 text-sm flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-slate-400" />
          مساحة التخزين (الملفات)
        </h2>
        <div className="neon-card p-5 rounded-2xl space-y-4">

          {/* Usage bar */}
          {filesUsage ? (() => {
            const pct = Math.min(100, Math.round((filesUsage.usedMB / filesUsage.limitMB) * 100));
            const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-indigo-500';
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>مستخدم: <span className="text-slate-900">{filesUsage.usedMB} MB</span></span>
                  <span>الحد: <span className="text-slate-900">{filesUsage.limitMB} MB</span></span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{pct}% مستخدم</span>
                  <span className={filesUsage.remainingMB < filesUsage.limitMB * 0.1 ? 'text-red-500 font-bold' : 'text-emerald-600 font-semibold'}>
                    فاضل {filesUsage.remainingMB} MB
                  </span>
                </div>
              </div>
            );
          })() : (
            <div className="text-slate-400 text-sm">بيتحمل...</div>
          )}

          {/* Limit input */}
          <form onSubmit={handleSaveLimit} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                الحد الأقصى للتخزين (MB)
              </label>
              <input
                type="number"
                min={1}
                required
                value={limitInput}
                onChange={e => setLimitInput(e.target.value)}
                className="neon-input w-full px-4 py-2.5 rounded-xl text-sm"
                placeholder="مثال: 500"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={limitSaving}
              className="neon-btn px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 shrink-0"
            >
              {limitSaving ? 'بيتحفظ...' : 'حفظ'}
            </button>
          </form>

          {limitMsg && (
            <p className={`text-sm font-semibold ${limitMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
              {limitMsg.text}
            </p>
          )}
        </div>
      </section>

      {/* ── Change Password ── */}
      <section className="space-y-3">
        <h2 className="font-bold text-slate-700 text-sm flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-slate-400" />
          غيّر كلمة السر
        </h2>
        <form onSubmit={handleChangePassword} className="neon-card p-5 rounded-2xl space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">كلمة السر الحالية</label>
            <input
              type="password" required value={currentPw} onChange={e => setCurrentPw(e.target.value)}
              className="neon-input w-full px-4 py-2.5 rounded-xl text-sm"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">كلمة السر الجديدة</label>
            <input
              type="password" required value={newPw} onChange={e => setNewPw(e.target.value)}
              className="neon-input w-full px-4 py-2.5 rounded-xl text-sm"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">أكد كلمة السر الجديدة</label>
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
            {pwSaving ? 'بيتحفظ...' : 'غيّر كلمة السر'}
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
              <h3 className="font-bold text-red-700">إعادة ضبط المنصة</h3>
              <p className="text-red-600/80 text-sm mt-0.5 leading-relaxed">
                يحذف هذا الإجراء بشكل <strong>نهائي</strong> كل الحصص، الاختبارات، الواجبات، أكواد الوصول، وتسليمات الطلاب.
                <br />
                <strong>حسابات الطلاب هتفضل موجودة.</strong>
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
              {resetting ? 'بيتمسح...' : 'إعادة ضبط المنصة'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
