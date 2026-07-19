import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Key, Upload, FileQuestion, FileText, Users, Mail, Menu, X, LogOut, ClipboardList, Trophy, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { path: '/youchem/upload', label: 'إدارة الفيديوهات', icon: Upload },
  { path: '/youchem/codes', label: 'أكواد الوصول', icon: Key },
  { path: '/youchem/quizzes', label: 'الاختبارات', icon: FileQuestion },
  { path: '/youchem/homework', label: 'الواجبات', icon: FileText },
  { path: '/youchem/students', label: 'الطلاب', icon: Users },
  { path: '/youchem/emails', label: 'البريد', icon: Mail },
  { path: '/youchem/grades/homework', label: 'درجات الواجب', icon: ClipboardList },
  { path: '/youchem/grades/quiz', label: 'درجات الاختبارات', icon: Trophy },
  { path: '/youchem/settings', label: 'الإعدادات', icon: Settings },
];

export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await fetch('/api/teacher/logout', { method: 'POST' });
    navigate('/youchem/login');
  };

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed inset-y-0 right-0 z-50 w-64 neon-panel border-l border-slate-200 flex flex-col transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="YouChem"
              className="h-10 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="w-9 h-9 bg-indigo-50 rounded-full hidden" />
            <span className="text-lg font-bold text-slate-900 tracking-tight">YouChem</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-slate-700 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-200 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 w-full text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors font-medium text-sm"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 neon-panel border-b border-slate-200 flex items-center px-4 lg:px-8 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden text-slate-400 hover:text-slate-700 ml-4 p-2 rounded-xl hover:bg-slate-100"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-sm border border-indigo-100">
              م
            </div>
            <span className="font-semibold text-slate-700 hidden sm:block text-sm">مستر أحمد</span>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
