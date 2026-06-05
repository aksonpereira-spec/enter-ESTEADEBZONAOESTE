import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  User, BookOpen, FileText, LogOut, Upload, Trash2, Save,
  GraduationCap, ChevronRight, Hash, Building2, Phone,
  MapPin, Heart, Download, AlertCircle, Star, TrendingUp,
  TrendingDown, Award, AlertTriangle, CalendarDays, Clock,
  Eye, EyeOff, Lock, Home, KeyRound, ShieldCheck,
  DollarSign, MessageCircle, Send, CheckCircle, ExternalLink, CreditCard
} from 'lucide-react';

const SESSION_KEY = 'portal_aluno_session';
const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

interface AlunoSession {
  alunoId: string;
  nome: string;
  matricula: string;
  turmaId: string | null;
  turmaNome: string;
}

interface ProfileData {
  nome_completo: string; cpf: string; rg: string; orgao_expedidor: string;
  data_nascimento: string; cidade_nascimento: string; uf_nascimento: string;
  sexo: string; estado_civil: string; profissao: string; email_contato: string;
  celular1: string; celular2: string; telefone: string; email: string;
  endereco: string; bairro: string; cidade: string; uf: string; cep: string;
  congregacao: string; igreja_membro: string; funcao_igreja: string;
  data_conversao: string; data_batismo: string;
  nome_pai: string; nome_mae: string; nivel_formacao: string;
  instituicao: string; habilidades: string;
}
interface Nota { id: string; disciplina_nome: string; disciplina_numero: number; nota: number | null; periodo: string; }
interface Arquivo { id: string; nome_arquivo: string; url: string; storage_path: string; uploaded_at: string; }
interface Evento { id: string; data_aula: string; professor: string; disciplina: string; obs: string; provas_disciplinas: string; }
interface Mensalidade { id: string; mes: string; valor: number; situacao: string; forma_pagamento: string; obs: string; comprovante_url: string; }
interface Observacao { id: string; mensagem: string; created_at: string; lida: boolean; }

const emptyProfile: ProfileData = {
  nome_completo: '', cpf: '', rg: '', orgao_expedidor: '', data_nascimento: '',
  cidade_nascimento: '', uf_nascimento: '', sexo: '', estado_civil: '', profissao: '',
  email_contato: '', celular1: '', celular2: '', telefone: '', email: '',
  endereco: '', bairro: '', cidade: '', uf: '', cep: '',
  congregacao: '', igreja_membro: '', funcao_igreja: '', data_conversao: '',
  data_batismo: '', nome_pai: '', nome_mae: '', nivel_formacao: '', instituicao: '', habilidades: '',
};

const getSituacao = (nota: number | null) => {
  if (nota === null) return { label: 'Cursando', color: 'rgba(255,255,255,0.4)' };
  if (nota >= 8) return { label: 'Excelente', color: '#34d399' };
  if (nota >= 7) return { label: 'Aprovado', color: '#60a5fa' };
  if (nota >= 5) return { label: 'Exame', color: '#fbbf24' };
  return { label: 'Reprovado', color: '#f87171' };
};

const getMensagem = (nota: number | null) => {
  if (nota === null) return null;
  if (nota >= 8) return { icon: 'star' as const, text: 'Parabéns! Excelente desempenho! Continue assim, você é um exemplo!', color: '#34d399' };
  if (nota >= 7) return { icon: 'up' as const, text: 'Ótimo! Você bateu a média! Você está no caminho certo!', color: '#60a5fa' };
  if (nota >= 5) return { icon: 'warn' as const, text: 'Atenção! Dedique-se mais para alcançar a nota máxima. Você consegue!', color: '#fbbf24' };
  return { icon: 'down' as const, text: 'Precisa de recuperação! Dedique-se mais aos estudos para alcançar a nota 10!', color: '#f87171' };
};

/* ─────────────── Shared input component ─────────────── */
function PortalInput({ label, type = 'text', value, onChange, placeholder, readOnly, name, right }: {
  label?: string; type?: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; readOnly?: boolean; name?: string; right?: React.ReactNode;
}) {
  return (
    <div>
      {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          type={type} value={value} name={name} readOnly={readOnly}
          autoComplete="off" autoCorrect="off" spellCheck={false}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="portal-input"
          style={readOnly ? { opacity: 0.6, cursor: 'default' } : {}}
        />
        {right && <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>{right}</div>}
      </div>
    </div>
  );
}

/* ─────────────── Password input with toggle ─────────────── */
function PasswordInput({ label, value, onChange, placeholder, name }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; name?: string; }) {
  const [show, setShow] = useState(false);
  return (
    <PortalInput
      label={label} type={show ? 'text' : 'password'} value={value} onChange={onChange}
      placeholder={placeholder} name={name}
      right={
        <button type="button" onClick={() => setShow(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0 }}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      }
    />
  );
}

/* ─────────────── Main Component ─────────────── */
export default function PortalAluno() {
  const [screen, setScreen] = useState<'login' | 'change-password' | 'portal'>('login');
  const [session, setSession] = useState<AlunoSession | null>(null);
  const [activeTab, setActiveTab] = useState<'inicio' | 'notas' | 'calendario' | 'financeiro' | 'ficha' | 'documentos'>('inicio');

  // Login state
  const [matriculaInput, setMatriculaInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Change password state
  const [tempAlunoId, setTempAlunoId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Ficha
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [alunoEmail, setAlunoEmail] = useState('');

  // Notas
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loadingNotas, setLoadingNotas] = useState(false);

  // Documentos
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Calendário
  const [eventos, setEventos] = useState<Evento[]>([]);

  // Financeiro
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);

  // Observações
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [sendingObs, setSendingObs] = useState(false);

  /* Load session on mount */
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const s = JSON.parse(saved) as AlunoSession;
        setSession(s);
        setScreen('portal');
      } catch { /* ignore */ }
    }
  }, []);

  /* Load data after login */
  const loadProfile = useCallback(async (alunoId: string) => {
    const { data: aluno } = await supabase.from('alunos').select('email, telefone').eq('id', alunoId).maybeSingle();
    if (aluno) setAlunoEmail(aluno.email || '');
    const { data } = await supabase.from('student_profiles').select('*').eq('aluno_id', alunoId).maybeSingle();
    if (data) {
      setProfileId(data.id);
      setProfile({
        nome_completo: data.nome_completo || '', cpf: data.cpf || '', rg: data.rg || '',
        orgao_expedidor: data.orgao_expedidor || '', data_nascimento: data.data_nascimento || '',
        cidade_nascimento: data.cidade_nascimento || '', uf_nascimento: data.uf_nascimento || '',
        sexo: data.sexo || '', estado_civil: data.estado_civil || '', profissao: data.profissao || '',
        email_contato: data.email_contato || '', celular1: data.celular1 || '', celular2: data.celular2 || '',
        telefone: data.telefone || '', email: data.email_contato || '',
        endereco: data.endereco || '', bairro: data.bairro || '', cidade: data.cidade || '',
        uf: data.uf || '', cep: data.cep || '', congregacao: data.congregacao || '',
        igreja_membro: data.igreja_membro || '', funcao_igreja: data.funcao_igreja || '',
        data_conversao: data.data_conversao || '', data_batismo: data.data_batismo || '',
        nome_pai: data.nome_pai || '', nome_mae: data.nome_mae || '',
        nivel_formacao: data.nivel_formacao || '', instituicao: data.instituicao || '', habilidades: data.habilidades || '',
      });
    } else {
      setProfileId(null);
      setProfile(emptyProfile);
    }
  }, []);

  const loadNotas = useCallback(async (alunoId: string) => {
    setLoadingNotas(true);
    const { data } = await supabase.from('notas_aluno').select('*').eq('aluno_id', alunoId).order('disciplina_numero', { ascending: true });
    setNotas(data || []);
    setLoadingNotas(false);
  }, []);

  const loadArquivos = useCallback(async (alunoId: string) => {
    const { data } = await supabase.from('portal_arquivos').select('*').eq('aluno_id', alunoId).order('uploaded_at', { ascending: false });
    setArquivos(data || []);
  }, []);

  const loadCalendario = useCallback(async () => {
    const { data } = await supabase.from('calendario_aulas').select('*').order('data_aula', { ascending: true });
    setEventos(data || []);
  }, []);

  const loadMensalidades = useCallback(async (alunoId: string) => {
    const { data } = await supabase.from('mensalidades').select('id, mes, valor, situacao, forma_pagamento, obs, comprovante_url').eq('aluno_id', alunoId).order('mes', { ascending: false });
    setMensalidades((data || []).map(r => ({
      id: r.id, mes: r.mes, valor: Number(r.valor) || 0,
      situacao: r.situacao || 'Pendente', forma_pagamento: r.forma_pagamento || '',
      obs: r.obs || '', comprovante_url: (r as { comprovante_url?: string }).comprovante_url || '',
    })));
  }, []);

  const loadObservacoes = useCallback(async (alunoId: string) => {
    const { data } = await supabase.from('observacoes_portal').select('*').eq('aluno_id', alunoId).order('created_at', { ascending: false });
    setObservacoes(data || []);
  }, []);

  useEffect(() => {
    if (session) {
      loadProfile(session.alunoId);
      loadNotas(session.alunoId);
      loadArquivos(session.alunoId);
      loadCalendario();
      loadMensalidades(session.alunoId);
      loadObservacoes(session.alunoId);
    }
  }, [session, loadProfile, loadNotas, loadArquivos, loadCalendario, loadMensalidades, loadObservacoes]);

  /* ─── LOGIN ─────────────────────────────────────────────── */
  const handleLogin = async () => {
    if (!matriculaInput.trim() || !senhaInput.trim()) {
      toast.error('Preencha matrícula e senha');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('alunos')
        .select('id, nome, matricula, turma_id, ativo, portal_bloqueado, senha_portal, senha_definida')
        .eq('matricula', matriculaInput.trim())
        .neq('matricula', '')
        .maybeSingle();

      if (error) throw error;
      if (!data) { toast.error('Matrícula não encontrada'); return; }
      if (!data.ativo) { toast.error('Aluno inativo. Contacte a secretaria.'); return; }
      if (data.portal_bloqueado) { toast.error('Acesso bloqueado. Contacte a secretaria.'); return; }

      // Validate password
      const senhaCorreta = data.senha_definida
        ? senhaInput.trim() === data.senha_portal
        : senhaInput.trim() === data.matricula;

      if (!senhaCorreta) {
        toast.error(data.senha_definida ? 'Senha incorreta' : 'Senha incorreta. Use sua matrícula como senha inicial.');
        return;
      }

      let turmaNome = '';
      if (data.turma_id) {
        const { data: turma } = await supabase.from('classes').select('nome').eq('id', data.turma_id).maybeSingle();
        turmaNome = turma?.nome || '';
      }

      setTempAlunoId(data.id);

      if (!data.senha_definida) {
        // Force password change before entering portal
        const s: AlunoSession = { alunoId: data.id, nome: data.nome, matricula: data.matricula || '', turmaId: data.turma_id, turmaNome };
        setSession(s);
        setScreen('change-password');
      } else {
        const s: AlunoSession = { alunoId: data.id, nome: data.nome, matricula: data.matricula || '', turmaId: data.turma_id, turmaNome };
        localStorage.setItem(SESSION_KEY, JSON.stringify(s));
        setSession(s);
        setScreen('portal');
        toast.success(`Bem-vindo, ${data.nome.split(' ')[0]}!`);
      }
    } catch {
      toast.error('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  /* ─── CHANGE PASSWORD ──────────────────────────────────── */
  const handleSavePassword = async () => {
    if (newPassword.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return; }
    if (newPassword !== confirmPassword) { toast.error('As senhas não coincidem'); return; }
    setSavingPassword(true);
    try {
      await supabase.from('alunos').update({ senha_portal: newPassword, senha_definida: true }).eq('id', tempAlunoId);
      if (session) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        setScreen('portal');
        toast.success(`Senha definida! Bem-vindo, ${session.nome.split(' ')[0]}!`);
      }
    } catch {
      toast.error('Erro ao salvar senha');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setScreen('login');
    setMatriculaInput('');
    setSenhaInput('');
    setNewPassword('');
    setConfirmPassword('');
    setActiveTab('inicio');
  };

  /* ─── SAVE PROFILE ─────────────────────────────────────── */
  const handleSaveProfile = async () => {
    if (!session) return;
    setSavingProfile(true);
    try {
      await supabase.from('alunos').update({ email: alunoEmail }).eq('id', session.alunoId);
      const payload = {
        aluno_id: session.alunoId, nome_completo: profile.nome_completo,
        cpf: profile.cpf, rg: profile.rg, orgao_expedidor: profile.orgao_expedidor,
        data_nascimento: profile.data_nascimento, cidade_nascimento: profile.cidade_nascimento,
        uf_nascimento: profile.uf_nascimento, sexo: profile.sexo, estado_civil: profile.estado_civil,
        profissao: profile.profissao, email_contato: profile.email_contato,
        celular1: profile.celular1, celular2: profile.celular2, telefone: profile.celular1,
        endereco: profile.endereco, bairro: profile.bairro, cidade: profile.cidade,
        uf: profile.uf, cep: profile.cep, congregacao: profile.congregacao,
        igreja_membro: profile.igreja_membro, funcao_igreja: profile.funcao_igreja,
        data_conversao: profile.data_conversao, data_batismo: profile.data_batismo,
        nome_pai: profile.nome_pai, nome_mae: profile.nome_mae,
        nivel_formacao: profile.nivel_formacao, instituicao: profile.instituicao,
        habilidades: profile.habilidades, updated_at: new Date().toISOString(),
      };
      if (profileId) {
        await supabase.from('student_profiles').update(payload).eq('id', profileId);
      } else {
        const { data } = await supabase.from('student_profiles').insert(payload).select().single();
        if (data) setProfileId(data.id);
      }
      toast.success('Informações salvas!');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSavingProfile(false);
    }
  };

  /* ─── FILE UPLOAD ──────────────────────────────────────── */
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('Arquivo muito grande (máx 20 MB)'); return; }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${session.alunoId}/${Date.now()}_${safeName}`;
      const { data: up, error } = await supabase.storage.from('portal-docs').upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('portal-docs').getPublicUrl(up.path);
      await supabase.from('portal_arquivos').insert({ aluno_id: session.alunoId, nome_arquivo: file.name, url: publicUrl, storage_path: up.path });
      toast.success('Arquivo enviado!');
      loadArquivos(session.alunoId);
    } catch { toast.error('Erro ao enviar arquivo'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleDeleteArquivo = async (arq: Arquivo) => {
    if (!session) return;
    if (arq.storage_path) await supabase.storage.from('portal-docs').remove([arq.storage_path]);
    await supabase.from('portal_arquivos').delete().eq('id', arq.id);
    toast.success('Arquivo removido');
    loadArquivos(session.alunoId);
  };

  const handleSendObservacao = async () => {
    if (!session || !novaMensagem.trim()) return;
    setSendingObs(true);
    try {
      await supabase.from('observacoes_portal').insert({ aluno_id: session.alunoId, mensagem: novaMensagem.trim() });
      setNovaMensagem('');
      toast.success('Mensagem enviada para a secretaria!');
      loadObservacoes(session.alunoId);
    } catch { toast.error('Erro ao enviar mensagem'); }
    finally { setSendingObs(false); }
  };

  const setP = (k: keyof ProfileData, v: string) => setProfile(p => ({ ...p, [k]: v }));

  /* ═══════════════════════════════════════════════════════════════
     SCREEN: LOGIN
  ═══════════════════════════════════════════════════════════════ */
  if (screen === 'login') {
    return (
      <div className="portal-bg flex items-center justify-center p-4" style={{ minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Logo area */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 72, height: 72, borderRadius: 20, marginBottom: 16,
              background: 'linear-gradient(135deg, hsl(221 60% 20%), hsl(221 60% 28%))',
              border: '1px solid hsl(43 90% 50% / 0.3)',
              boxShadow: '0 8px 32px hsl(43 90% 50% / 0.15)'
            }}>
              <GraduationCap size={32} style={{ color: 'hsl(43 90% 55%)' }} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#e8eaf6', marginBottom: 4 }}>Portal do Aluno</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em' }}>ESTEADEB — Escola Teológica</p>
          </div>

          {/* Card */}
          <div className="portal-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <PortalInput label="Número de Matrícula" value={matriculaInput}
                onChange={setMatriculaInput} placeholder="Ex: 2026001" name="portal-matricula" />
              <PasswordInput label="Senha" value={senhaInput}
                onChange={setSenhaInput} placeholder="Sua senha de acesso" name="portal-senha" />
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={11} />
                No primeiro acesso, a senha é o número da sua matrícula
              </p>
              <button
                onClick={handleLogin} disabled={loading || !matriculaInput.trim() || !senhaInput.trim()}
                className="gold-btn" style={{ width: '100%', padding: '11px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14 }}>
                {loading
                  ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#080c18', animation: 'spin 0.7s linear infinite' }} />
                  : <ChevronRight size={16} />}
                {loading ? 'Verificando...' : 'Entrar no Portal'}
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 20 }}>
              Não possui matrícula? Contacte a secretaria.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     SCREEN: FORCE CHANGE PASSWORD
  ═══════════════════════════════════════════════════════════════ */
  if (screen === 'change-password') {
    return (
      <div className="portal-bg flex items-center justify-center p-4" style={{ minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 64, height: 64, borderRadius: 18, marginBottom: 14,
              background: 'linear-gradient(135deg, hsl(43 80% 20%), hsl(43 80% 30%))',
              border: '1px solid hsl(43 90% 50% / 0.4)',
              boxShadow: '0 8px 28px hsl(43 90% 50% / 0.2)'
            }}>
              <KeyRound size={28} style={{ color: 'hsl(43 90% 55%)' }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e8eaf6', marginBottom: 6 }}>Defina sua Senha</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
              Olá, <strong style={{ color: 'hsl(43 90% 60%)' }}>{session?.nome.split(' ')[0]}</strong>! Por segurança, defina uma senha pessoal para acessar o portal.
            </p>
          </div>

          <div className="portal-card-gold" style={{ padding: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <ShieldCheck size={16} style={{ color: 'hsl(43 90% 55%)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                  A senha deve ter pelo menos 6 caracteres. Anote em local seguro.
                </span>
              </div>
              <PasswordInput label="Nova Senha" value={newPassword} onChange={setNewPassword} placeholder="Mínimo 6 caracteres" name="new-password" />
              <PasswordInput label="Confirmar Senha" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repita a nova senha" name="confirm-password" />
              <button
                onClick={handleSavePassword}
                disabled={savingPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                className="gold-btn"
                style={{ width: '100%', padding: '11px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, marginTop: 4 }}>
                {savingPassword
                  ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#080c18', animation: 'spin 0.7s linear infinite' }} />
                  : <Lock size={15} />}
                {savingPassword ? 'Salvando...' : 'Salvar Senha e Entrar'}
              </button>
              {newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p style={{ fontSize: 12, color: '#f87171', textAlign: 'center' }}>As senhas não coincidem</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     SCREEN: PORTAL
  ═══════════════════════════════════════════════════════════════ */
  if (!session) return null;

  // Compute next event
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const nextEvento = eventos.find(e => new Date(e.data_aula + 'T00:00:00') >= today);
  const notasComNota = notas.filter(n => n.nota !== null);
  const mediaGeral = notasComNota.length > 0 ? notasComNota.reduce((s, n) => s + Number(n.nota), 0) / notasComNota.length : null;

  // Tab nav items
  const tabs = [
    { id: 'inicio' as const, label: 'Início', icon: Home },
    { id: 'notas' as const, label: 'Notas', icon: BookOpen },
    { id: 'calendario' as const, label: 'Calendário', icon: CalendarDays },
    { id: 'financeiro' as const, label: 'Financeiro', icon: DollarSign },
    { id: 'ficha' as const, label: 'Minha Ficha', icon: User },
    { id: 'documentos' as const, label: 'Documentos', icon: FileText },
  ];

  return (
    <div className="portal-bg" style={{ minHeight: '100vh' }}>
      {/* ── Header ── */}
      <header className="portal-header" style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, hsl(221 60% 25%), hsl(221 60% 32%))', border: '1px solid hsl(43 90% 50% / 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: 'hsl(43 90% 55%)' }}>{session.nome.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#e8eaf6', lineHeight: 1.2 }}>{session.nome}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>{session.matricula}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {session.turmaNome && (
              <span style={{ fontSize: 11, background: 'hsl(43 90% 50% / 0.1)', color: 'hsl(43 90% 60%)', padding: '3px 10px', borderRadius: 20, border: '1px solid hsl(43 90% 50% / 0.2)', fontWeight: 600, display: 'none' }}
                className="sm:inline-block">{session.turmaNome}</span>
            )}
            <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: 8, transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)'; }}>
              <LogOut size={14} />Sair
            </button>
          </div>
        </div>
      </header>

      {/* ── Tab Navigation ── */}
      <div style={{ position: 'sticky', top: 56, zIndex: 20, background: '#060c1a', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 12px', display: 'flex', overflowX: 'auto', gap: 4, paddingBottom: 6, paddingTop: 6 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`portal-tab ${activeTab === t.id ? 'active' : ''}`}>
              <t.icon size={14} />{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* ══ TAB: INÍCIO ══════════════════════════════════════════ */}
        {activeTab === 'inicio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Hero */}
            <div className="portal-card" style={{
              background: 'linear-gradient(135deg, #0d1a40 0%, #112050 50%, #0d1835 100%)',
              border: '1px solid hsl(43 90% 50% / 0.2)',
              padding: 28, position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'hsl(43 90% 50% / 0.04)' }} />
              <div style={{ position: 'absolute', bottom: -30, right: 60, width: 100, height: 100, borderRadius: '50%', background: 'hsl(221 83% 53% / 0.08)' }} />
              <p style={{ fontSize: 13, color: 'hsl(43 90% 60%)', fontWeight: 600, marginBottom: 6 }}>Bem-vindo de volta,</p>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: '#e8eaf6', marginBottom: 10, lineHeight: 1.2 }}>{session.nome}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                  <Hash size={12} /><span>Matrícula: <strong style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>{session.matricula}</strong></span>
                </div>
                {session.turmaNome && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    <BookOpen size={12} /><span>Turma: <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{session.turmaNome}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div className="portal-card" style={{ padding: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 24, fontWeight: 800, color: 'hsl(43 90% 55%)', marginBottom: 4 }}>{notas.length}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>DISCIPLINAS</p>
              </div>
              <div className="portal-card" style={{ padding: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 24, fontWeight: 800, color: mediaGeral !== null ? (mediaGeral >= 7 ? '#34d399' : mediaGeral >= 5 ? '#fbbf24' : '#f87171') : 'rgba(255,255,255,0.3)', marginBottom: 4 }}>
                  {mediaGeral !== null ? mediaGeral.toFixed(1) : '—'}
                </p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>MÉDIA GERAL</p>
              </div>
              <div className="portal-card" style={{ padding: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 24, fontWeight: 800, color: '#60a5fa', marginBottom: 4 }}>{arquivos.length}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>DOCUMENTOS</p>
              </div>
            </div>

            {/* Next class */}
            {nextEvento && (
              <div className="portal-card-gold" style={{ padding: 18 }}>
                <p style={{ fontSize: 11, color: 'hsl(43 90% 60%)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Próxima Aula
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: 'hsl(43 90% 50% / 0.15)', border: '1px solid hsl(43 90% 50% / 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CalendarDays size={22} style={{ color: 'hsl(43 90% 55%)' }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15, color: '#e8eaf6', marginBottom: 3 }}>{nextEvento.disciplina}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                      {new Date(nextEvento.data_aula + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} • {nextEvento.professor}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Financial summary */}
            {mensalidades.length > 0 && (() => {
              const recent = mensalidades.slice(0, 3);
              const temPendente = recent.some(m => m.situacao !== 'Pago');
              const temAtrasado = recent.some(m => m.situacao === 'Atrasado');
              return (
                <div className={temAtrasado ? 'portal-card' : 'portal-card'} style={{
                  background: temAtrasado ? 'linear-gradient(135deg, #2d0a0a, #3d1010)' : 'linear-gradient(145deg, #0d1631, #111d3a)',
                  border: `1px solid ${temAtrasado ? '#f871711a' : 'hsl(43 90% 50% / 0.2)'}`,
                  padding: 18
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: temAtrasado ? '#f87171' : 'hsl(43 90% 60%)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CreditCard size={13} />Situação Financeira
                    </p>
                    <button onClick={() => setActiveTab('financeiro')} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                      Ver todos <ChevronRight size={11} />
                    </button>
                  </div>
                  {temAtrasado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', marginBottom: 12 }}>
                      <AlertTriangle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>Atenção: há mensalidade(s) em atraso. Contacte a secretaria.</p>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {recent.map(m => {
                      const [y, mo] = m.mes.split('-');
                      const mesNome = `${MESES_PT[parseInt(mo)-1]} ${y}`;
                      const isPago = m.situacao === 'Pago';
                      const isAtrasado = m.situacao === 'Atrasado';
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{mesNome}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {m.valor > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>R$ {m.valor.toFixed(2).replace('.',',')}</span>}
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: isPago ? 'rgba(52,211,153,0.12)' : isAtrasado ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)', color: isPago ? '#34d399' : isAtrasado ? '#f87171' : '#fbbf24', border: `1px solid ${isPago ? 'rgba(52,211,153,0.2)' : isAtrasado ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.2)'}` }}>
                              {isPago && <CheckCircle size={9} style={{ display: 'inline', marginRight: 3 }} />}{m.situacao}
                            </span>
                            {m.comprovante_url && (
                              <a href={m.comprovante_url} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                                <ExternalLink size={11} />PDF
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {temPendente && !temAtrasado && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 10, textAlign: 'center' }}>
                      Regularize seu pagamento pelo PIX ou presencialmente
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Navigation cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[
                { id: 'notas' as const, icon: BookOpen, label: 'Minhas Notas', desc: `${notas.length} disciplinas`, color: '#60a5fa' },
                { id: 'calendario' as const, icon: CalendarDays, label: 'Calendário', desc: nextEvento ? 'Próxima aula agendada' : 'Ver agenda', color: 'hsl(43 90% 55%)' },
                { id: 'financeiro' as const, icon: DollarSign, label: 'Financeiro', desc: `${mensalidades.filter(m => m.situacao === 'Pago').length} pago${mensalidades.filter(m => m.situacao === 'Pago').length !== 1 ? 's' : ''}`, color: '#34d399' },
                { id: 'ficha' as const, icon: User, label: 'Minha Ficha', desc: 'Dados pessoais', color: '#a78bfa' },
                { id: 'documentos' as const, icon: FileText, label: 'Documentos', desc: `${arquivos.length} arquivo${arquivos.length !== 1 ? 's' : ''}`, color: '#fb923c' },
              ].map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className="portal-card"
                  style={{ padding: 18, textAlign: 'left', cursor: 'pointer', border: 'none', transition: 'all 0.2s', display: 'block', width: '100%' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.borderColor = `${item.color}30`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <item.icon size={20} style={{ color: item.color }} />
                  </div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#e8eaf6', marginBottom: 3 }}>{item.label}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{item.desc}</p>
                </button>
              ))}
            </div>

            {/* Observações / Reclamações */}
            <div className="portal-card" style={{ padding: 20 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#e8eaf6', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <MessageCircle size={15} style={{ color: 'hsl(43 90% 55%)' }} />Fale com a Secretaria
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 14 }}>
                Dúvidas, reclamações, sugestões ou observações
              </p>
              <textarea
                value={novaMensagem} onChange={e => setNovaMensagem(e.target.value)}
                placeholder="Escreva aqui sua mensagem para a secretaria..."
                rows={3}
                className="portal-input"
                style={{ resize: 'vertical', minHeight: 80, fontFamily: 'inherit', lineHeight: 1.5 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button onClick={handleSendObservacao} disabled={sendingObs || !novaMensagem.trim()}
                  className="gold-btn" style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  {sendingObs
                    ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#080c18', animation: 'spin 0.7s linear infinite' }} />
                    : <Send size={13} />}
                  {sendingObs ? 'Enviando...' : 'Enviar Mensagem'}
                </button>
              </div>
              {observacoes.length > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mensagens enviadas</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {observacoes.slice(0, 5).map(o => (
                      <div key={o.id} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 4 }}>{o.mensagem}</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                          {new Date(o.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {o.lida && <span style={{ marginLeft: 8, color: '#34d399' }}>• Lida pela secretaria</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ TAB: NOTAS ══════════════════════════════════════════ */}
        {activeTab === 'notas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Motivational banner */}
            {mediaGeral !== null && (() => {
              const isGreat = mediaGeral >= 8;
              const isGood = mediaGeral >= 7;
              const bg = isGreat ? 'linear-gradient(135deg, #052e1a, #073d22)' : isGood ? 'linear-gradient(135deg, #071a3e, #0c2456)' : 'linear-gradient(135deg, #2d1a00, #3d2500)';
              const iconEl = isGreat ? <Award size={22} style={{ color: '#34d399' }} /> : isGood ? <TrendingUp size={22} style={{ color: '#60a5fa' }} /> : <AlertTriangle size={22} style={{ color: '#fbbf24' }} />;
              const textColor = isGreat ? '#34d399' : isGood ? '#60a5fa' : '#fbbf24';
              const msg = isGreat
                ? `Parabéns, ${session.nome.split(' ')[0]}! Sua média ${mediaGeral.toFixed(1)} é excelente! Continue assim!`
                : isGood
                ? `Ótimo, ${session.nome.split(' ')[0]}! Média ${mediaGeral.toFixed(1)} — você bateu a média! Continue firme!`
                : `Atenção, ${session.nome.split(' ')[0]}! Média ${mediaGeral.toFixed(1)} — dedique-se mais para alcançar a nota 10!`;
              return (
                <div className="portal-card" style={{ background: bg, border: `1px solid ${textColor}25`, padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ flexShrink: 0, marginTop: 1 }}>{iconEl}</div>
                  <p style={{ fontSize: 14, color: textColor, fontWeight: 600, lineHeight: 1.5 }}>{msg}</p>
                </div>
              );
            })()}

            {/* Header */}
            <div className="portal-card" style={{ padding: 16, borderBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 15, color: '#e8eaf6', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <GraduationCap size={16} style={{ color: 'hsl(43 90% 55%)' }} />Situação Escolar Parcial
                  </h3>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                    {session.nome} — <span style={{ fontFamily: 'monospace' }}>{session.matricula}</span>
                  </p>
                </div>
                {session.turmaNome && <span style={{ fontSize: 11, background: 'hsl(221 83% 53% / 0.15)', color: '#93c5fd', padding: '4px 10px', borderRadius: 20, border: '1px solid hsl(221 83% 53% / 0.2)', fontWeight: 600 }}>{session.turmaNome}</span>}
              </div>
            </div>

            {loadingNotas ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div className="loading-spinner" style={{ margin: '0 auto', borderColor: 'rgba(255,255,255,0.1)', borderTopColor: 'hsl(43 90% 55%)' }} />
              </div>
            ) : notas.length === 0 ? (
              <div className="portal-card" style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                <BookOpen size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p style={{ fontWeight: 600 }}>Nenhuma nota lançada ainda</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>As notas serão disponibilizadas pela secretaria</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {notas.map(n => {
                  const sit = getSituacao(n.nota);
                  const msg = getMensagem(n.nota);
                  return (
                    <div key={n.id} className="portal-card" style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.3)', width: 24, textAlign: 'center', flexShrink: 0 }}>{n.disciplina_numero}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: 14, color: '#e8eaf6' }}>{n.disciplina_nome}</p>
                          {msg && (
                            <p style={{ fontSize: 11, color: msg.color, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {msg.icon === 'star' && <Star size={11} />}
                              {msg.icon === 'up' && <TrendingUp size={11} />}
                              {msg.icon === 'warn' && <AlertTriangle size={11} />}
                              {msg.icon === 'down' && <TrendingDown size={11} />}
                              {msg.text}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <span style={{ fontSize: 22, fontWeight: 800, color: sit.color, minWidth: 40, textAlign: 'center' }}>
                            {n.nota !== null ? Number(n.nota).toFixed(1) : '—'}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: sit.color, background: `${sit.color}15`, border: `1px solid ${sit.color}30`, padding: '3px 10px', borderRadius: 20, minWidth: 72, textAlign: 'center' }}>
                            {sit.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {notas.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, fontSize: 11, color: 'rgba(255,255,255,0.3)', flexWrap: 'wrap' }}>
                {[['#34d399','Excelente 8–10'], ['#60a5fa','Aprovado 7'], ['#fbbf24','Exame 5–6'], ['#f87171','Reprovado <5']].map(([c, l]) => (
                  <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: CALENDÁRIO ═════════════════════════════════════ */}
        {activeTab === 'calendario' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Banner */}
            <div className="portal-card" style={{
              background: 'linear-gradient(135deg, #0a1428 0%, #0d1a40 100%)',
              border: '1px solid hsl(43 90% 50% / 0.2)',
              padding: '20px 24px', textAlign: 'center'
            }}>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 4 }}>Segue o calendário das próximas aulas,</p>
              <p style={{ fontSize: 20, fontWeight: 800 }} className="gold-gradient">se organizem!</p>
            </div>

            {(() => {
              const groups: Record<string, Evento[]> = {};
              eventos.forEach(e => {
                const d = new Date(e.data_aula + 'T00:00:00');
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(e);
              });
              if (Object.keys(groups).length === 0) return (
                <div className="portal-card" style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                  <CalendarDays size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} /><p>Nenhum evento cadastrado</p>
                </div>
              );
              return Object.entries(groups).map(([key, evs]) => {
                const [year, month] = key.split('-').map(Number);
                const isPast = new Date(year, month, 0) < today;
                return (
                  <div key={key} style={{ opacity: isPast ? 0.4 : 1, filter: isPast ? 'grayscale(0.6)' : 'none', transition: 'all 0.3s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Clock size={16} style={{ color: isPast ? 'rgba(255,255,255,0.3)' : 'hsl(43 90% 55%)' }} />
                      <span style={{ fontWeight: 800, fontSize: 15, color: isPast ? 'rgba(255,255,255,0.3)' : '#e8eaf6', letterSpacing: '0.05em' }}>
                        {MESES_PT[month-1].toUpperCase()} {year}
                      </span>
                      {isPast && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>PASSADO</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                      {evs.map(ev => {
                        const d = new Date(ev.data_aula + 'T00:00:00');
                        const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        return (
                          <div key={ev.id} className={isPast ? 'portal-card' : 'portal-card-gold'} style={{ padding: 16 }}>
                            <p style={{ fontSize: 11, fontFamily: 'monospace', color: isPast ? 'rgba(255,255,255,0.3)' : 'hsl(43 90% 60%)', fontWeight: 600, marginBottom: 10 }}>{dateStr}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'hsl(221 60% 40% / 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontWeight: 800, fontSize: 12, color: '#93c5fd' }}>{ev.professor.charAt(0)}</span>
                              </div>
                              <span style={{ fontWeight: 700, fontSize: 14, color: '#e8eaf6' }}>{ev.professor}</span>
                            </div>
                            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: ev.obs ? 12 : 0 }}>{ev.disciplina}</p>
                            {ev.obs && (
                              <div style={{ background: 'hsl(43 80% 50% / 0.08)', border: '1px solid hsl(43 80% 50% / 0.25)', borderRadius: 10, padding: 12 }}>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
                                  <AlertTriangle size={13} style={{ color: 'hsl(43 90% 60%)', flexShrink: 0, marginTop: 1 }} />
                                  <span style={{ fontSize: 10, fontWeight: 800, color: 'hsl(43 90% 60%)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Observação:</span>
                                </div>
                                <p style={{ fontSize: 12, color: 'hsl(43 70% 70%)', lineHeight: 1.5 }}>{ev.obs}</p>
                                {ev.provas_disciplinas && (
                                  <p style={{ fontSize: 12, fontWeight: 600, color: 'hsl(43 80% 65%)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'hsl(43 90% 60%)', display: 'inline-block', flexShrink: 0 }} />{ev.provas_disciplinas}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* ══ TAB: FINANCEIRO ══════════════════════════════════════ */}
        {activeTab === 'financeiro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="portal-card" style={{ padding: '18px 20px', background: 'linear-gradient(135deg, #0a1428 0%, #0d1a40 100%)', border: '1px solid hsl(43 90% 50% / 0.2)' }}>
              <h3 style={{ fontWeight: 800, fontSize: 16, color: '#e8eaf6', display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign size={16} style={{ color: 'hsl(43 90% 55%)' }} />Situação Financeira
              </h3>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Consulta somente leitura — para dúvidas contacte a secretaria</p>
            </div>

            {mensalidades.length === 0 ? (
              <div className="portal-card" style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                <DollarSign size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p style={{ fontWeight: 600 }}>Nenhum lançamento financeiro</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Os pagamentos serão registrados pela secretaria</p>
              </div>
            ) : (
              <>
                {/* Summary stats */}
                {(() => {
                  const pagos = mensalidades.filter(m => m.situacao === 'Pago');
                  const pendentes = mensalidades.filter(m => m.situacao !== 'Pago' && m.situacao !== 'Atrasado');
                  const atrasados = mensalidades.filter(m => m.situacao === 'Atrasado');
                  const totalPago = pagos.reduce((s, m) => s + m.valor, 0);
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      <div className="portal-card" style={{ padding: 14, textAlign: 'center' }}>
                        <p style={{ fontSize: 20, fontWeight: 800, color: '#34d399' }}>{pagos.length}</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginTop: 2 }}>PAGAS</p>
                        {totalPago > 0 && <p style={{ fontSize: 11, color: '#34d399', marginTop: 2, fontFamily: 'monospace' }}>R$ {totalPago.toFixed(2).replace('.',',')}</p>}
                      </div>
                      <div className="portal-card" style={{ padding: 14, textAlign: 'center' }}>
                        <p style={{ fontSize: 20, fontWeight: 800, color: '#fbbf24' }}>{pendentes.length}</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginTop: 2 }}>PENDENTES</p>
                      </div>
                      <div className="portal-card" style={{ padding: 14, textAlign: 'center' }}>
                        <p style={{ fontSize: 20, fontWeight: 800, color: atrasados.length > 0 ? '#f87171' : 'rgba(255,255,255,0.3)' }}>{atrasados.length}</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginTop: 2 }}>ATRASADAS</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Table */}
                <div className="portal-card" style={{ overflow: 'hidden' }}>
                  {mensalidades.map((m, i) => {
                    const [y, mo] = m.mes.split('-');
                    const mesNome = `${MESES_PT[parseInt(mo)-1]} ${y}`;
                    const isPago = m.situacao === 'Pago';
                    const isAtrasado = m.situacao === 'Atrasado';
                    return (
                      <div key={m.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
                        borderBottom: i < mensalidades.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        transition: 'background 0.15s'
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: isPago ? 'rgba(52,211,153,0.12)' : isAtrasado ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {isPago ? <CheckCircle size={18} style={{ color: '#34d399' }} /> : isAtrasado ? <AlertTriangle size={18} style={{ color: '#f87171' }} /> : <Clock size={18} style={{ color: '#fbbf24' }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 14, color: '#e8eaf6' }}>{mesNome}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                            {m.forma_pagamento && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{m.forma_pagamento}</span>}
                            {m.obs && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>• {m.obs}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          {m.valor > 0 && (
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>
                              R$ {m.valor.toFixed(2).replace('.',',')}
                            </span>
                          )}
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: isPago ? 'rgba(52,211,153,0.12)' : isAtrasado ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)', color: isPago ? '#34d399' : isAtrasado ? '#f87171' : '#fbbf24', border: `1px solid ${isPago ? 'rgba(52,211,153,0.2)' : isAtrasado ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.2)'}`, minWidth: 68, textAlign: 'center' }}>
                            {m.situacao}
                          </span>
                          {m.comprovante_url ? (
                            <a href={m.comprovante_url} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#60a5fa', fontWeight: 600 }}>
                              <ExternalLink size={13} />Comprovante
                            </a>
                          ) : (
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '0 8px' }}>
                  Os valores e situações são gerenciados pela secretaria. Em caso de divergência, use o campo "Fale com a Secretaria" na página inicial.
                </p>
              </>
            )}
          </div>
        )}

        {/* ══ TAB: MINHA FICHA ════════════════════════════════════ */}
        {activeTab === 'ficha' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Dados Escolares */}
            <Section title="Dados Escolares" icon={<Hash size={15} style={{ color: 'hsl(43 90% 55%)' }} />}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <ReadField label="Matrícula" value={session.matricula} mono />
                <ReadField label="Turma" value={session.turmaNome || '—'} />
                <ReadField label="Nome" value={session.nome} />
              </div>
            </Section>

            <Section title="Dados Pessoais" icon={<User size={15} style={{ color: 'hsl(43 90% 55%)' }} />}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <PortalInput label="Nome Completo" value={profile.nome_completo} onChange={v => setP('nome_completo', v)} placeholder="Nome completo" />
                </div>
                <PortalInput label="CPF" value={profile.cpf} onChange={v => setP('cpf', v)} placeholder="000.000.000-00" />
                <PortalInput label="RG" value={profile.rg} onChange={v => setP('rg', v)} placeholder="Número do RG" />
                <PortalInput label="Órgão Expedidor" value={profile.orgao_expedidor} onChange={v => setP('orgao_expedidor', v)} placeholder="SSP/XX" />
                <PortalInput label="Data Nascimento" type="date" value={profile.data_nascimento} onChange={v => setP('data_nascimento', v)} />
                <PortalInput label="Cidade Nascimento" value={profile.cidade_nascimento} onChange={v => setP('cidade_nascimento', v)} placeholder="Cidade" />
                <PortalInput label="UF Nascimento" value={profile.uf_nascimento} onChange={v => setP('uf_nascimento', v)} placeholder="XX" />
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 6 }}>Sexo</label>
                  <Select value={profile.sexo || 'none'} onValueChange={v => setP('sexo', v === 'none' ? '' : v)}>
                    <SelectTrigger className="portal-input" style={{ height: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#e8eaf0', borderRadius: 12 }}>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Feminino">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 6 }}>Estado Civil</label>
                  <Select value={profile.estado_civil || 'none'} onValueChange={v => setP('estado_civil', v === 'none' ? '' : v)}>
                    <SelectTrigger className="portal-input" style={{ height: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#e8eaf0', borderRadius: 12 }}>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                      <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                      <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                      <SelectItem value="Viúvo(a)">Viúvo(a)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <PortalInput label="Profissão" value={profile.profissao} onChange={v => setP('profissao', v)} placeholder="Profissão" />
              </div>
            </Section>

            <Section title="Contato" icon={<Phone size={15} style={{ color: 'hsl(43 90% 55%)' }} />}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <PortalInput label="Celular Principal" value={profile.celular1} onChange={v => setP('celular1', v)} placeholder="(00) 00000-0000" />
                <PortalInput label="Celular Secundário" value={profile.celular2} onChange={v => setP('celular2', v)} placeholder="(00) 00000-0000" />
                <PortalInput label="E-mail" type="email" value={alunoEmail} onChange={setAlunoEmail} placeholder="email@exemplo.com" />
                <PortalInput label="E-mail Alternativo" type="email" value={profile.email_contato} onChange={v => setP('email_contato', v)} placeholder="email@exemplo.com" />
              </div>
            </Section>

            <Section title="Endereço" icon={<MapPin size={15} style={{ color: 'hsl(43 90% 55%)' }} />}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <PortalInput label="Endereço" value={profile.endereco} onChange={v => setP('endereco', v)} placeholder="Rua, número, complemento" />
                </div>
                <PortalInput label="CEP" value={profile.cep} onChange={v => setP('cep', v)} placeholder="00000-000" />
                <PortalInput label="Bairro" value={profile.bairro} onChange={v => setP('bairro', v)} placeholder="Bairro" />
                <PortalInput label="Cidade" value={profile.cidade} onChange={v => setP('cidade', v)} placeholder="Cidade" />
                <PortalInput label="UF" value={profile.uf} onChange={v => setP('uf', v)} placeholder="XX" />
              </div>
            </Section>

            <Section title="Igreja" icon={<Building2 size={15} style={{ color: 'hsl(43 90% 55%)' }} />}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <PortalInput label="Congregação" value={profile.congregacao} onChange={v => setP('congregacao', v)} placeholder="Nome da congregação" />
                <PortalInput label="Igreja Membro" value={profile.igreja_membro} onChange={v => setP('igreja_membro', v)} placeholder="Igreja" />
                <PortalInput label="Função na Igreja" value={profile.funcao_igreja} onChange={v => setP('funcao_igreja', v)} placeholder="Pastor, Diácono..." />
                <PortalInput label="Data Conversão" type="date" value={profile.data_conversao} onChange={v => setP('data_conversao', v)} />
                <PortalInput label="Data Batismo" type="date" value={profile.data_batismo} onChange={v => setP('data_batismo', v)} />
              </div>
            </Section>

            <Section title="Família e Formação" icon={<Heart size={15} style={{ color: 'hsl(43 90% 55%)' }} />}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <PortalInput label="Nome do Pai" value={profile.nome_pai} onChange={v => setP('nome_pai', v)} placeholder="Nome do pai" />
                <PortalInput label="Nome da Mãe" value={profile.nome_mae} onChange={v => setP('nome_mae', v)} placeholder="Nome da mãe" />
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 6 }}>Nível de Formação</label>
                  <Select value={profile.nivel_formacao || 'none'} onValueChange={v => setP('nivel_formacao', v === 'none' ? '' : v)}>
                    <SelectTrigger className="portal-input" style={{ height: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#e8eaf0', borderRadius: 12 }}>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="Fundamental">Fundamental</SelectItem>
                      <SelectItem value="Médio">Médio</SelectItem>
                      <SelectItem value="Superior">Superior</SelectItem>
                      <SelectItem value="Pós-graduação">Pós-graduação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <PortalInput label="Instituição" value={profile.instituicao} onChange={v => setP('instituicao', v)} placeholder="Escola/Faculdade" />
                <div style={{ gridColumn: '1 / -1' }}>
                  <PortalInput label="Habilidades / Talentos" value={profile.habilidades} onChange={v => setP('habilidades', v)} placeholder="Ex: Música, Liderança..." />
                </div>
              </div>
            </Section>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleSaveProfile} disabled={savingProfile} className="gold-btn"
                style={{ padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                {savingProfile ? <div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#080c18', animation: 'spin 0.7s linear infinite' }} /> : <Save size={15} />}
                {savingProfile ? 'Salvando...' : 'Salvar Informações'}
              </button>
            </div>
          </div>
        )}

        {/* ══ TAB: DOCUMENTOS ═════════════════════════════════════ */}
        {activeTab === 'documentos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="portal-card" style={{ padding: 20 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#e8eaf6', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={15} style={{ color: 'hsl(43 90% 55%)' }} />Enviar Documento
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>
                Certificados, comprovantes, declarações e outros documentos pessoais (máx 20 MB)
              </p>
              <input ref={fileRef} type="file" id="file-upload" onChange={handleUploadFile} className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" />
              <label htmlFor="file-upload" style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: 100, border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 14, cursor: uploading ? 'wait' : 'pointer',
                transition: 'all 0.2s', opacity: uploading ? 0.5 : 1
              }}
                onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLLabelElement).style.borderColor = 'hsl(43 90% 50% / 0.4)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}>
                {uploading ? (
                  <div className="loading-spinner" style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: 'hsl(43 90% 55%)' }} />
                ) : (
                  <>
                    <Upload size={22} style={{ color: 'rgba(255,255,255,0.3)', marginBottom: 8 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Clique para selecionar arquivo</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>PDF, DOC, JPG, PNG</span>
                  </>
                )}
              </label>
            </div>

            <div className="portal-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#e8eaf6', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={15} style={{ color: 'hsl(43 90% 55%)' }} />Meus Documentos
                  {arquivos.length > 0 && <span style={{ fontSize: 11, background: 'hsl(43 90% 50% / 0.12)', color: 'hsl(43 90% 60%)', padding: '2px 8px', borderRadius: 20, border: '1px solid hsl(43 90% 50% / 0.2)', fontWeight: 600 }}>{arquivos.length}</span>}
                </p>
              </div>
              {arquivos.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
                  <FileText size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                  <p style={{ fontWeight: 600, fontSize: 13 }}>Nenhum documento enviado</p>
                </div>
              ) : (
                <div>
                  {arquivos.map(arq => (
                    <div key={arq.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'hsl(221 60% 30% / 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={16} style={{ color: '#93c5fd' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{arq.nome_arquivo}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          {new Date(arq.uploaded_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <a href={arq.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'rgba(96,165,250,0.1)', color: '#60a5fa', transition: 'all 0.15s', textDecoration: 'none' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(96,165,250,0.2)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(96,165,250,0.1)'; }}>
                          <Download size={14} />
                        </a>
                        <button onClick={() => handleDeleteArquivo(arq)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'rgba(248,113,113,0.08)', color: '#f87171', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.18)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.08)'; }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .sm\\:inline-block { display: none; }
        @media (min-width: 640px) { .sm\\:inline-block { display: inline-block !important; } }
      `}</style>
    </div>
  );
}

/* ─── Helper sub-components ─────────────────────────────────── */
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="portal-card" style={{ padding: 20 }}>
      <p style={{ fontWeight: 700, fontSize: 14, color: '#e8eaf6', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {icon}{title}
      </p>
      {children}
    </div>
  );
}

function ReadField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
      <p style={{ fontWeight: 600, fontSize: 14, color: '#e8eaf6', fontFamily: mono ? 'monospace' : undefined }}>{value || '—'}</p>
    </div>
  );
}
