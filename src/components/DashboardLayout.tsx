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
    <div className="min-h-screen bg-slate-50 flex" dir="rtl">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 right-0 z-50 w-64 bg-white border-l border-slate-200 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="YouChem Logo" className="w-10 h-10 object-contain rounded-full border-2 border-slate-100" onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }} />
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-inner hidden">
              YC
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">YouChem</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-500 hover:text-slate-700">
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
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full text-slate-600 hover:bg-slate-50 hover:text-red-600 rounded-lg transition-colors font-medium">
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-8">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden text-slate-600 hover:text-slate-900 ml-4"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex-1" />
          
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
              م
            </div>
            <span className="font-medium text-slate-700 hidden sm:block">المدرس</span>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
