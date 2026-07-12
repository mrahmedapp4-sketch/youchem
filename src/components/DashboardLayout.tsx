import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Key, Upload, FileQuestion, Users, Mail, Menu, X, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';

const navItems = [
  { path: '/youchem/upload', label: 'إدارة الفيديوهات', icon: Upload },
  { path: '/youchem/codes', label: 'أكواد', icon: Key },
  { path: '/youchem/quizzes', label: 'Quizzes', icon: FileQuestion },
  { path: '/youchem/students', label: 'طلاب', icon: Users },
  { path: '/youchem/emails', label: 'Gmails', icon: Mail },
];

export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Close sidebar on route change on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    // SERVER ACTION: Logout
    await fetch('/api/teacher/logout', { method: 'POST' });
    navigate('/youchem/login');
  };

  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 right-0 z-50 w-64 neon-panel border-l transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-20 flex items-center justify-between px-6 border-b border-cyan-500/10">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="YouChem Logo" className="w-10 h-10 object-contain rounded-full border-2 border-cyan-400/30" onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }} />
            <div className="w-10 h-10 bg-cyan-500/10 rounded-full flex items-center justify-center text-cyan-400 font-bold text-xl hidden">
              YC
            </div>
            <span className="text-xl font-bold text-white tracking-tight">YouChem</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                  isActive 
                    ? 'bg-cyan-400/10 text-cyan-300 shadow-[inset_0_0_0_1px_rgba(34,229,255,0.25)]' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-cyan-500/10">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors font-medium">
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 neon-panel border-b flex items-center px-4 lg:px-8">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden text-slate-400 hover:text-white ml-4"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex-1" />
          
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-cyan-400/10 flex items-center justify-center text-cyan-300 font-bold border border-cyan-400/20">
              م
            </div>
            <span className="font-medium text-slate-300 hidden sm:block">المدرس</span>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
