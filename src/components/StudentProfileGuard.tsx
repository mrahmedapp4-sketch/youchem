import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

export function StudentProfileGuard() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/student/check-auth');
        if (!res.ok) {
          if (active) navigate('/', { replace: true });
          return;
        }

        const data = await res.json();
        if (active) {
          if (data.needsProfile) navigate('/', { replace: true });
          else setChecking(false);
        }
      } catch {
        if (active) navigate('/', { replace: true });
      }
    })();

    return () => {
      active = false;
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500" dir="rtl">
        بيتحقق من بياناتك...
      </div>
    );
  }

  return <Outlet />;
}