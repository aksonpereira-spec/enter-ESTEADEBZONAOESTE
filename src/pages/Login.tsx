import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, User, LogIn, Shield, BookOpen, GraduationCap, UserPlus, Eye, EyeOff, Hash, ChevronLeft, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

type Mode = 'select' | 'admin' | 'student-login' | 'student-signup';

const Login = () => {
  const { isAuthenticated, userRole, login, loginStudent, signUpStudent, isLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('select');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [studentPwd, setStudentPwd] = useState('');
  const [studentPwdConfirm, setStudentPwdConfirm] = useState('');
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={userRole === 'admin' ? '/' : '/portal'} replace />;
  }

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 300));
    const ok = login(username, password);
    if (!ok) { toast.error('Credenciais inválidas'); setIsSubmitting(false); }
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { error } = await loginStudent(email, studentPwd);
    if (error) { toast.error('Email ou senha incorretos'); setIsSubmitting(false); }
    else navigate('/portal');
  };

  const handleStudentSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (studentPwd !== studentPwdConfirm) { toast.error('As senhas não coincidem'); return; }
    if (studentPwd.length < 6) { toast.error('Senha deve ter pelo menos 6 caracteres'); return; }
    setIsSubmitting(true);
    const { error } = await signUpStudent(email, studentPwd, matricula, nome);
    if (error) { toast.error(error); setIsSubmitting(false); }
    else {
      toast.success('Conta criada com sucesso! Abrindo seu portal...');
      navigate('/portal'); // redirect explícito após signup (auto-confirm já autentica)
    }
  };

  const inputStyle = { background: 'hsl(0 0% 100% / 0.08)', border: '1px solid hsl(0 0% 100% / 0.12)', WebkitAppearance: 'none' as const };
  const inputClass = "w-full h-11 pl-10 pr-4 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 transition-all";

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, hsl(221 40% 12%), hsl(240 35% 8%))' }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, hsl(221 83% 65%), transparent)' }} />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full opacity-5" style={{ background: 'radial-gradient(circle, hsl(250 80% 65%), transparent)' }} />

        <div className="relative z-10 text-center max-w-md">
          <img src="/logo-esteadeb.png" alt="ESTEADEB" className="h-20 w-auto object-contain mx-auto mb-8 drop-shadow-xl" />
          <h1 className="text-2xl font-black text-white mb-2 leading-tight">
            ESTEADEB NÚCLEO ZONA OESTE
          </h1>
          <p className="text-3xl font-bold text-white/80 mb-3">
            Seja Bem-vindo!
          </p>
          <p className="text-white/40 text-sm leading-relaxed">
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

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-6">
            <img src="/logo-esteadeb.png" alt="ESTEADEB" className="h-12 w-auto object-contain mx-auto mb-3" />
            <p className="text-white font-bold text-lg">ESTEADEB NÚCLEO ZONA OESTE</p>
            <p className="text-white/60 text-sm">Seja Bem-vindo!</p>
          </div>

          <div className="rounded-3xl p-7 shadow-2xl" style={{ background: 'hsl(0 0% 100% / 0.05)', border: '1px solid hsl(0 0% 100% / 0.10)', backdropFilter: 'blur(20px)' }}>

            {/* ── SELECT MODE ─────────────────────────────────── */}
            {mode === 'select' && (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white">Acesso ao Sistema</h2>
                  <p className="text-white/40 text-sm mt-1">Selecione o tipo de acesso</p>
                </div>
                <button
                  onClick={() => setMode('admin')}
                  className="w-full rounded-2xl p-5 text-left transition-all hover:scale-[1.02] group"
                  style={{ background: 'hsl(0 0% 100% / 0.08)', border: '1px solid hsl(0 0% 100% / 0.15)' }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(250 80% 58%))' }}>
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Acesso do Coordenador</p>
                      <p className="text-white/40 text-xs mt-0.5">Gestão completa do sistema</p>
                    </div>
                    <LogIn className="w-4 h-4 text-white/30 ml-auto group-hover:text-white/60 transition-colors" />
                  </div>
                </button>

                <button
                  onClick={() => navigate('/portal-aluno')}
                  className="w-full rounded-2xl p-5 text-left transition-all hover:scale-[1.02] group"
                  style={{ background: 'hsl(0 0% 100% / 0.08)', border: '1px solid hsl(0 0% 100% / 0.15)' }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, hsl(160 60% 45%), hsl(180 60% 40%))' }}>
                      <GraduationCap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Portal do Aluno</p>
                      <p className="text-white/40 text-xs mt-0.5">Acesse com seu número de matrícula</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-white/30 ml-auto group-hover:text-white/60 transition-colors" />
                  </div>
                </button>
              </div>
            )}

            {/* ── ADMIN LOGIN ──────────────────────────────────── */}
            {mode === 'admin' && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => setMode('select')} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-white">Acesso do Coordenador</h2>
                    <p className="text-white/40 text-xs mt-0.5">Digite suas credenciais</p>
                  </div>
                </div>
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Usuário</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" required className={inputClass} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className={inputClass} style={inputStyle} />
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm text-white transition-all mt-2" style={{ background: 'linear-gradient(135deg, hsl(221 83% 53%), hsl(250 80% 58%))', boxShadow: '0 4px 20px hsl(221 83% 53% / 0.4)' }}>
                    {isSubmitting ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <><LogIn className="w-4 h-4" />Entrar no Sistema</>}
                  </button>
                </form>
              </>
            )}

            {/* ── STUDENT LOGIN ─────────────────────────────────── */}
            {mode === 'student-login' && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => setMode('select')} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-white">Portal do Aluno</h2>
                    <p className="text-white/40 text-xs mt-0.5">Acesse com seu e-mail</p>
                  </div>
                </div>
                <form onSubmit={handleStudentLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">E-mail</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required className={inputClass} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input type={showPwd ? 'text' : 'password'} value={studentPwd} onChange={e => setStudentPwd(e.target.value)} placeholder="••••••••" required className={`${inputClass} pr-10`} style={inputStyle} />
                      <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm text-white transition-all" style={{ background: 'linear-gradient(135deg, hsl(160 60% 45%), hsl(180 60% 40%))', boxShadow: '0 4px 20px hsl(160 60% 45% / 0.4)' }}>
                    {isSubmitting ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <><LogIn className="w-4 h-4" />Entrar no Portal</>}
                  </button>
                </form>
                <div className="mt-5 pt-4 border-t border-white/10 text-center">
                  <p className="text-white/40 text-xs mb-2">Ainda não tem conta?</p>
                  <button onClick={() => { setMode('student-signup'); setStudentPwd(''); }} className="text-sm font-medium text-white/70 hover:text-white transition-colors flex items-center gap-1.5 mx-auto">
                    <UserPlus className="w-4 h-4" />Criar conta de aluno
                  </button>
                </div>
              </>
            )}

            {/* ── STUDENT SIGNUP ────────────────────────────────── */}
            {mode === 'student-signup' && (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <button onClick={() => setMode('student-login')} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-white">Criar Conta</h2>
                    <p className="text-white/40 text-xs mt-0.5">Portal do Aluno</p>
                  </div>
                </div>
                <form onSubmit={handleStudentSignup} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Nome Completo</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" className={inputClass} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Matrícula (opcional)</label>
                    <div className="relative">
                      <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input type="text" value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="Ex: 2026001" className={inputClass} style={inputStyle} />
                    </div>
                    <p className="text-white/30 text-xs mt-1">Informe sua matrícula para vincular ao cadastro</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">E-mail *</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required className={inputClass} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Senha *</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input type={showPwd ? 'text' : 'password'} value={studentPwd} onChange={e => setStudentPwd(e.target.value)} placeholder="Mínimo 6 caracteres" required className={`${inputClass} pr-10`} style={inputStyle} />
                      <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                        {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Confirmar Senha *</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input type={showPwd ? 'text' : 'password'} value={studentPwdConfirm} onChange={e => setStudentPwdConfirm(e.target.value)} placeholder="Repita a senha" required className={inputClass} style={inputStyle} />
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full h-11 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm text-white transition-all mt-1" style={{ background: 'linear-gradient(135deg, hsl(160 60% 45%), hsl(180 60% 40%))' }}>
                    {isSubmitting ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <><UserPlus className="w-4 h-4" />Criar Conta</>}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-white/15 text-xs mt-5">
            ESTEADEB — Escola Teológica das Assembleias de Deus no Brasil
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
