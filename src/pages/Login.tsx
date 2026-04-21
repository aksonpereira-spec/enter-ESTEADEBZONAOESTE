import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, User, LogIn, Shield, BookOpen, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const { isAuthenticated, login, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 400));
    const ok = login(username, password);
    if (!ok) {
      toast.error('Credenciais inválidas');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, hsl(221 40% 14%), hsl(240 35% 10%))' }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, hsl(221 83% 65%), transparent)' }} />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, hsl(250 80% 65%), transparent)' }} />

        <div className="relative z-10 text-center max-w-sm">
          <img src="/logo-esteadeb.png" alt="ESTEADEB" className="h-20 w-auto object-contain mx-auto mb-8 drop-shadow-xl" />
          <h1 className="text-3xl font-black text-white mb-3 leading-tight">
            Sistema de<br />Gestão Escolar
          </h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Escola Teológica das Assembleias de Deus no Brasil
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { icon: GraduationCap, label: 'Alunos' },
              { icon: BookOpen, label: 'Turmas' },
              { icon: Shield, label: 'Financeiro' },
            ].map(f => (
              <div key={f.label} className="flex flex-col items-center gap-2 p-4 rounded-2xl" style={{ background: 'hsl(0 0% 100% / 0.06)' }}>
                <f.icon className="w-6 h-6 text-white/60" />
                <span className="text-xs text-white/50 font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            <img src="/logo-esteadeb.png" alt="ESTEADEB" className="h-14 w-auto object-contain mx-auto mb-4" />
          </div>

          {/* Card */}
          <div className="rounded-3xl p-8 shadow-2xl" style={{ background: 'hsl(0 0% 100% / 0.05)', border: '1px solid hsl(0 0% 100% / 0.10)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">Bem-vindo</h2>
              <p className="text-white/50 text-sm mt-1">Faça login para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">Usuário</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    required
                    className="w-full h-11 pl-10 pr-4 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 transition-all"
                    style={{ background: 'hsl(0 0% 100% / 0.08)', border: '1px solid hsl(0 0% 100% / 0.12)', WebkitAppearance: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full h-11 pl-10 pr-4 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 transition-all"
                    style={{ background: 'hsl(0 0% 100% / 0.08)', border: '1px solid hsl(0 0% 100% / 0.12)', WebkitAppearance: 'none' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm text-white transition-all mt-2"
                style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(250 80% 58%))', boxShadow: '0 4px 20px hsl(221 83% 53% / 0.4)' }}
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <><LogIn className="w-4 h-4" />Entrar no Sistema</>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-white/20 text-xs mt-6">
            ESTEADEB — Sistema de Gestão Escolar
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
