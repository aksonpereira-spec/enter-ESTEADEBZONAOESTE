import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'student';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  userRole: UserRole | null;
  studentId: string | null;     // aluno.id
  studentName: string | null;
  studentAuthId: string | null; // auth.users.id
  session: Session | null;
  login: (username: string, password: string) => boolean;
  loginStudent: (email: string, password: string) => Promise<{ error?: string }>;
  signUpStudent: (email: string, password: string, matricula?: string, nome?: string) => Promise<{ error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const safeStorage = {
  get: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set: (key: string, value: string): void => {
    try { localStorage.setItem(key, value); } catch { /* silent */ }
  },
  remove: (key: string): void => {
    try { localStorage.removeItem(key); } catch { /* silent */ }
  },
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [studentAuthId, setStudentAuthId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const resolveStudent = async (userId: string) => {
    const { data } = await supabase
      .from('student_profiles')
      .select('aluno_id, nome_completo, alunos(nome)')
      .eq('auth_user_id', userId)
      .maybeSingle();
    if (data) {
      setStudentId(data.aluno_id ?? null);
      const nome = data.nome_completo || (data.alunos as { nome?: string } | null)?.nome || null;
      setStudentName(nome);
    }
  };

  useEffect(() => {
    // Check admin auth from localStorage first
    const adminAuth = safeStorage.get('esteadeb_auth');
    if (adminAuth === 'true') {
      setIsAuthenticated(true);
      setUserRole('admin');
      setIsLoading(false);
      return;
    }

    // Setup Supabase auth listener for students
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        setIsAuthenticated(true);
        setUserRole('student');
        setStudentAuthId(sess.user.id);
        setTimeout(() => resolveStudent(sess.user.id), 0);
      } else if (safeStorage.get('esteadeb_auth') !== 'true') {
        setIsAuthenticated(false);
        setUserRole(null);
        setStudentId(null);
        setStudentName(null);
        setStudentAuthId(null);
      }
      setIsLoading(false);
    });

    // Check existing session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (sess?.user) {
        setSession(sess);
        setIsAuthenticated(true);
        setUserRole('student');
        setStudentAuthId(sess.user.id);
        setTimeout(() => resolveStudent(sess.user.id), 0);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = (username: string, password: string): boolean => {
    if (username === 'admin' && password === '1234') {
      setIsAuthenticated(true);
      setUserRole('admin');
      safeStorage.set('esteadeb_auth', 'true');
      return true;
    }
    return false;
  };

  const loginStudent = async (email: string, password: string): Promise<{ error?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      setIsAuthenticated(true);
      setUserRole('student');
      setStudentAuthId(data.user.id);
      setSession(data.session);
      await resolveStudent(data.user.id);
    }
    return {};
  };

  const signUpStudent = async (email: string, password: string, matricula?: string, nome?: string): Promise<{ error?: string }> => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (!data.user) return { error: 'Não foi possível criar a conta.' };

    const userId = data.user.id;
    let alunoId: string | null = null;

    // Set auth state immediately (auto-confirm already signed in)
    setIsAuthenticated(true);
    setUserRole('student');
    setStudentAuthId(userId);
    if (data.session) setSession(data.session);

    // Try to link to existing aluno by matricula
    if (matricula?.trim()) {
      const { data: aluno } = await supabase.from('alunos').select('id, nome').eq('matricula', matricula.trim()).maybeSingle();
      if (aluno) {
        alunoId = aluno.id;
        setStudentId(aluno.id);
        setStudentName(aluno.nome);
      }
    }

    if (nome?.trim()) setStudentName(nome.trim());

    // Create student profile (upsert to handle duplicate signups)
    const { error: insErr } = await supabase.from('student_profiles').upsert({
      auth_user_id: userId,
      aluno_id: alunoId,
      nome_completo: nome?.trim() || '',
      email_contato: email,
    }, { onConflict: 'auth_user_id' });

    if (insErr) {
      console.error('Profile insert error:', insErr);
    }

    return {};
  };

  const logout = async () => {
    if (userRole === 'admin') {
      safeStorage.remove('esteadeb_auth');
    } else {
      await supabase.auth.signOut();
    }
    setIsAuthenticated(false);
    setUserRole(null);
    setStudentId(null);
    setStudentName(null);
    setStudentAuthId(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated, isLoading, userRole,
      studentId, studentName, studentAuthId, session,
      login, loginStudent, signUpStudent, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
