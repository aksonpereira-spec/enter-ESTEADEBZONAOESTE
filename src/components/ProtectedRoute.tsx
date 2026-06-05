import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'student';
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, userRole } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(221 40% 14%), hsl(240 35% 10%))' }}>
        <div className="flex flex-col items-center gap-4">
          <img src="/logo-esteadeb.png" alt="ESTEADEB" className="h-12 w-auto object-contain opacity-80 mb-2" />
          <div className="w-10 h-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          <p className="text-white/50 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Director has same access as admin
  const effectiveRole = userRole === 'director' ? 'admin' : userRole;

  if (requiredRole && effectiveRole !== requiredRole) {
    if (effectiveRole === 'admin') return <Navigate to="/" replace />;
    if (effectiveRole === 'student') return <Navigate to="/portal" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
