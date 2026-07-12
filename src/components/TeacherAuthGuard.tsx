import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export function TeacherAuthGuard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/teacher/check-auth');
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, [location.pathname]);

  if (isAuthenticated === null) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">جاري التحقق...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/youchem/login" replace />;
  }

  return <Outlet />;
}
