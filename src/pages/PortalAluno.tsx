import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
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
  DollarSign, MessageCircle, Send, CheckCircle, ExternalLink, CreditCard, ShoppingBag,
  Copy, QrCode, ChevronDown, ChevronUp as ChevronUpIcon, Upload as UploadIcon
} from 'lucide-react';

const SESSION_KEY = 'portal_aluno_session';
const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

/* ── PIX helpers ──────────────────────────────────────────── */
function crc16pix(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function buildPixEMV(cnpj: string, name: string, city: string): string {
  const c = cnpj.replace(/\D/g, '');
  const f = (t: string, v: string) => `${t}${String(v.length).padStart(2, '0')}${v}`;
  const mai = f('26', f('00', 'BR.GOV.BCB.PIX') + f('01', c));
  const body = f('00','01') + mai + f('52','0000') + f('53','986') + f('58','BR') + f('59', name.substring(0,25)) + f('60', city.substring(0,15)) + f('62', f('05','***')) + '6304';
  return body + crc16pix(body);
}
const PIX_CNPJ = '40800393000132';
const PIX_DISPLAY = '40.800.393/0001-32';
const PIX_EMV = buildPixEMV(PIX_CNPJ, 'ESTEADEB', 'BRASIL');

const FAQ_PIX = [
  { id: 1, q: 'Como realizar o pagamento?', a: 'Abra o aplicativo do seu banco, acesse a área PIX, escaneie o QR Code ao lado ou copie a chave CNPJ. Informe o valor da sua mensalidade e confirme o pagamento.' },
  { id: 2, q: 'Como enviar o comprovante?', a: 'Após pagar, localize sua mensalidade na lista abaixo e clique em "Enviar Comprovante". Selecione o arquivo (PDF, JPG ou PNG) e confirme. O coordenador será notificado.' },
  { id: 3, q: 'Em quanto tempo é confirmado?', a: 'Pagamentos via PIX são processados em instantes. A confirmação no sistema pelo coordenador pode levar até 1 dia útil. Acompanhe o status aqui no portal.' },
  { id: 4, q: 'Qual é o vencimento da mensalidade?', a: 'O vencimento é no último dia útil de cada mês. Pagamentos realizados após essa data geram multa e juros. Em caso de dificuldades, entre em contato com o coordenador.' },
  { id: 5, q: 'O QR Code tem valor definido?', a: 'Não. O QR Code gerado aqui é de valor aberto — você informa o valor no seu aplicativo bancário. Certifique-se de inserir o valor correto da mensalidade em aberto.' },
];

// ── Light theme tokens ─────────────────────────────────────────
const T = {
  bg: '#f0f4fc',
  white: '#ffffff',
  cardBorder: '#e2e8f5',
  cardBorderBlue: '#bfcfee',
  blue: '#2563eb',
  blueDark: '#1e3a8a',
  blueMid: '#1e40af',
  blueLight: '#eff6ff',
  blueFaint: 'rgba(37,99,235,0.08)',
  text: '#1e2d5a',
  textSec: '#475569',
  textMuted: '#94a3c8',
  textFaint: '#b8c7e0',
  green: '#16a34a',
  greenBg: '#f0fdf4',
  greenBorder: 'rgba(22,163,74,0.2)',
  amber: '#d97706',
  amberBg: '#fffbeb',
  amberBorder: 'rgba(217,119,6,0.2)',
  red: '#dc2626',
  redBg: '#fef2f2',
  redBorder: 'rgba(220,38,38,0.2)',
  inputBg: '#f8fafd',
  shadow: '0 1px 4px rgba(30,60,140,0.06)',
  shadowMd: '0 2px 12px rgba(30,60,140,0.1)',
};

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
interface Observacao { id: string; mensagem: string; created_at: string; lida: boolean; resposta: string | null; respondida_em: string | null; }

const emptyProfile: ProfileData = {
  nome_completo: '', cpf: '', rg: '', orgao_expedidor: '', data_nascimento: '',
  cidade_nascimento: '', uf_nascimento: '', sexo: '', estado_civil: '', profissao: '',
  email_contato: '', celular1: '', celular2: '', telefone: '', email: '',
  endereco: '', bairro: '', cidade: '', uf: '', cep: '',
  congregacao: '', igreja_membro: '', funcao_igreja: '', data_conversao: '',
  data_batismo: '', nome_pai: '', nome_mae: '', nivel_formacao: '', instituicao: '', habilidades: '',
};

const getSituacao = (nota: number | null) => {
  if (nota === null) return { label: 'Cursando', color: T.textMuted };
  if (nota >= 8) return { label: 'Excelente', color: T.green };
  if (nota >= 7) return { label: 'Aprovado', color: T.blue };
  if (nota >= 5) return { label: 'Exame', color: T.amber };
  return { label: 'Reprovado', color: T.red };
};

const getMensagem = (nota: number | null) => {
  if (nota === null) return null;
  if (nota >= 8) return { icon: 'star' as const, text: 'Parabéns! Excelente desempenho! Continue assim, você é um exemplo!', color: T.green };
  if (nota >= 7) return { icon: 'up' as const, text: 'Ótimo! Você bateu a média! Você está no caminho certo!', color: T.blue };
  if (nota >= 5) return { icon: 'warn' as const, text: 'Atenção! Dedique-se mais para alcançar a nota máxima. Você consegue!', color: T.amber };
  return { icon: 'down' as const, text: 'Precisa de recuperação! Dedique-se mais aos estudos para alcançar a nota 10!', color: T.red };
};

/* ─────────────── Shared input component ─────────────── */
function PortalInput({ label, type = 'text', value, onChange, placeholder, readOnly, name, right }: {
  label?: string; type?: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; readOnly?: boolean; name?: string; right?: React.ReactNode;
}) {
  return (
    <div>
      {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: T.textSec, textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>}
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
        <button type="button" onClick={() => setShow(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 0 }}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      }
    />
  );
}

/* ─────────────── Main Component ─────────────── */
export default function PortalAluno() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<'login' | 'change-password' | 'portal'>('login');
  const [session, setSession] = useState<AlunoSession | null>(null);
  const [activeTab, setActiveTab] = useState<'inicio' | 'notas' | 'calendario' | 'financeiro' | 'ficha' | 'documentos'>('inicio');

  const [matriculaInput, setMatriculaInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [tempAlunoId, setTempAlunoId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [alunoEmail, setAlunoEmail] = useState('');

  const [notas, setNotas] = useState<Nota[]>([]);
  const [loadingNotas, setLoadingNotas] = useState(false);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [sendingObs, setSendingObs] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(1);
  const [uploadingMensId, setUploadingMensId] = useState<string | null>(null);
  const pendingMensIdRef = useRef<string | null>(null);
  const mensCompRef = useRef<HTMLInputElement>(null);

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
    } else { setProfileId(null); setProfile(emptyProfile); }
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
    setObservacoes((data || []).map(r => ({
      id: r.id, mensagem: r.mensagem, created_at: r.created_at, lida: r.lida ?? false,
      resposta: (r as { resposta?: string | null }).resposta ?? null,
      respondida_em: (r as { respondida_em?: string | null }).respondida_em ?? null,
    })));
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
    if (!matriculaInput.trim() || !senhaInput.trim()) { toast.error('Preencha matrícula e senha'); return; }
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
      const senhaCorreta = data.senha_definida
        ? senhaInput.trim() === data.senha_portal
        : senhaInput.trim() === data.matricula;
      if (!senhaCorreta) { toast.error(data.senha_definida ? 'Senha incorreta' : 'Senha incorreta. Use sua matrícula como senha inicial.'); return; }
      let turmaNome = '';
      if (data.turma_id) {
        const { data: turma } = await supabase.from('classes').select('nome').eq('id', data.turma_id).maybeSingle();
        turmaNome = turma?.nome || '';
      }
      setTempAlunoId(data.id);
      const s: AlunoSession = { alunoId: data.id, nome: data.nome, matricula: data.matricula || '', turmaId: data.turma_id, turmaNome };
      setSession(s);
      if (!data.senha_definida) { setScreen('change-password'); }
      else {
        localStorage.setItem(SESSION_KEY, JSON.stringify(s));
        setScreen('portal');
        toast.success(`Bem-vindo, ${data.nome.split(' ')[0]}!`);
      }
    } catch { toast.error('Erro ao fazer login. Tente novamente.'); }
    finally { setLoading(false); }
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
    } catch { toast.error('Erro ao salvar senha'); }
    finally { setSavingPassword(false); }
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
      if (profileId) { await supabase.from('student_profiles').update(payload).eq('id', profileId); }
      else {
        const { data } = await supabase.from('student_profiles').insert(payload).select().single();
        if (data) setProfileId(data.id);
      }
      toast.success('Informações salvas!');
    } catch { toast.error('Erro ao salvar'); }
    finally { setSavingProfile(false); }
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

  const handleSendObservacao = async () => {    if (!session || !novaMensagem.trim()) return;
    setSendingObs(true);
    try {
      await supabase.from('observacoes_portal').insert({ aluno_id: session.alunoId, mensagem: novaMensagem.trim() });
      setNovaMensagem('');
      toast.success('Mensagem enviada para o coordenador!');
      loadObservacoes(session.alunoId);
    } catch { toast.error('Erro ao enviar mensagem'); }
    finally { setSendingObs(false); }
  };

  const handleStudentComprovante = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const mensId = pendingMensIdRef.current;
    if (!file || !session || !mensId) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('Arquivo muito grande (máx 20 MB)'); return; }
    setUploadingMensId(mensId);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${session.alunoId}/${mensId}_${Date.now()}_${safe}`;
      const { data: up, error } = await supabase.storage.from('comprovantes').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('comprovantes').getPublicUrl(up.path);
      await supabase.from('mensalidades').update({ comprovante_url: publicUrl, comprovante_path: up.path }).eq('id', mensId);
      toast.success('Comprovante enviado! O coordenador será notificado.');
      loadMensalidades(session.alunoId);
    } catch { toast.error('Erro ao enviar comprovante'); }
    finally { setUploadingMensId(null); pendingMensIdRef.current = null; if (mensCompRef.current) mensCompRef.current.value = ''; }
  };

  const setP = (k: keyof ProfileData, v: string) => setProfile(p => ({ ...p, [k]: v }));

  /* ─── Spinner ───── */
  const Spinner = ({ color = T.blue }: { color?: string }) => (
    <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${color}30`, borderTopColor: color, animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
  );

  /* ═══════════════════════════════════════════════════════════
     SCREEN: LOGIN
  ═══════════════════════════════════════════════════════════ */
  if (screen === 'login') {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 20, marginBottom: 16, background: T.blueDark, boxShadow: '0 8px 24px rgba(30,58,138,0.3)' }}>
              <GraduationCap size={32} style={{ color: '#ffffff' }} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, marginBottom: 4 }}>Portal do Aluno</h1>
            <p style={{ fontSize: 13, color: T.textMuted, letterSpacing: '0.04em' }}>ESTEADEB — Escola Teológica</p>
          </div>
          {/* Card */}
          <div className="portal-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <PortalInput label="Número de Matrícula" value={matriculaInput} onChange={setMatriculaInput} placeholder="Ex: 2026001" name="portal-matricula" />
              <PasswordInput label="Senha" value={senhaInput} onChange={setSenhaInput} placeholder="Sua senha de acesso" name="portal-senha" />
              <p style={{ fontSize: 11, color: T.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={11} />No primeiro acesso, a senha é o número da sua matrícula
              </p>
              <button onClick={handleLogin} disabled={loading || !matriculaInput.trim() || !senhaInput.trim()}
                className="gold-btn" style={{ width: '100%', padding: '11px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14 }}>
                {loading ? <Spinner color="#fff" /> : <ChevronRight size={16} />}
                {loading ? 'Verificando...' : 'Entrar no Portal'}
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: 12, color: T.textFaint, marginTop: 20 }}>
              Não possui matrícula? Contacte a secretaria.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     SCREEN: FORCE CHANGE PASSWORD
  ═══════════════════════════════════════════════════════════ */
  if (screen === 'change-password') {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 18, marginBottom: 14, background: T.blue, boxShadow: '0 8px 20px rgba(37,99,235,0.3)' }}>
              <KeyRound size={28} style={{ color: '#ffffff' }} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, marginBottom: 6 }}>Defina sua Senha</h1>
            <p style={{ fontSize: 13, color: T.textSec, lineHeight: 1.5 }}>
              Olá, <strong style={{ color: T.blue }}>{session?.nome.split(' ')[0]}</strong>! Por segurança, defina uma senha pessoal para acessar o portal.
            </p>
          </div>
          <div className="portal-card-blue" style={{ padding: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: T.blueLight, border: `1px solid ${T.cardBorderBlue}` }}>
                <ShieldCheck size={16} style={{ color: T.blue, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: T.textSec, lineHeight: 1.4 }}>A senha deve ter pelo menos 6 caracteres. Anote em local seguro.</span>
              </div>
              <PasswordInput label="Nova Senha" value={newPassword} onChange={setNewPassword} placeholder="Mínimo 6 caracteres" name="new-password" />
              <PasswordInput label="Confirmar Senha" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repita a nova senha" name="confirm-password" />
              <button onClick={handleSavePassword} disabled={savingPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                className="gold-btn" style={{ width: '100%', padding: '11px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, marginTop: 4 }}>
                {savingPassword ? <Spinner color="#fff" /> : <Lock size={15} />}
                {savingPassword ? 'Salvando...' : 'Salvar Senha e Entrar'}
              </button>
              {newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p style={{ fontSize: 12, color: T.red, textAlign: 'center' }}>As senhas não coincidem</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     SCREEN: PORTAL
  ═══════════════════════════════════════════════════════════ */
  if (!session) return null;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const nextEvento = eventos.find(e => new Date(e.data_aula + 'T00:00:00') >= today);
  const notasComNota = notas.filter(n => n.nota !== null);
  const mediaGeral = notasComNota.length > 0 ? notasComNota.reduce((s, n) => s + Number(n.nota), 0) / notasComNota.length : null;

  const tabs = [
    { id: 'inicio' as const, label: 'Início', icon: Home },
    { id: 'notas' as const, label: 'Notas', icon: BookOpen },
    { id: 'calendario' as const, label: 'Calendário', icon: CalendarDays },
    { id: 'financeiro' as const, label: 'Financeiro', icon: DollarSign },
    { id: 'ficha' as const, label: 'Minha Ficha', icon: User },
    { id: 'documentos' as const, label: 'Documentos', icon: FileText },
  ];

  return (
    <div style={{ background: T.bg, minHeight: '100vh' }}>
      {/* ── Header ── */}
      <header className="portal-header" style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#ffffff' }}>{session.nome.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#ffffff', lineHeight: 1.2 }}>{session.nome}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{session.matricula}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {session.turmaNome && (
              <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.15)', color: '#ffffff', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.25)', fontWeight: 600 }}>
                {session.turmaNome}
              </span>
            )}
            <button onClick={() => navigate('/loja')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#ffffff', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', padding: '5px 12px', borderRadius: 8, transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'; }}>
              <ShoppingBag size={14} />Loja
            </button>
            <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: 8, transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fca5a5'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'; }}>
              <LogOut size={14} />Sair
            </button>
          </div>
        </div>
      </header>

      {/* ── Tab Navigation ── */}
      <div style={{ position: 'sticky', top: 56, zIndex: 20, background: T.white, borderBottom: `1px solid ${T.cardBorder}`, boxShadow: '0 1px 4px rgba(30,60,140,0.06)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 12px', display: 'flex', overflowX: 'auto', gap: 4, paddingBottom: 6, paddingTop: 6 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`portal-tab ${activeTab === t.id ? 'active' : ''}`}>
              <t.icon size={14} />{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      {/* ── Financial Status Banner (persistent, always visible) ── */}
      {mensalidades.length > 0 && (() => {
        const atrasados = mensalidades.filter(m => m.situacao === 'Atrasado');
        const pendentes = mensalidades.filter(m => m.situacao === 'Pendente');
        if (atrasados.length > 0) {
          return (
            <div style={{ background: '#7f1d1d', borderBottom: '3px solid #dc2626', padding: '12px 16px' }}>
              <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }}>
                  <AlertTriangle size={18} style={{ color: '#ffffff' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 800, fontSize: 14, color: '#fca5a5', lineHeight: 1.2 }}>
                    ATENÇÃO: {atrasados.length} MENSALIDADE{atrasados.length > 1 ? 'S' : ''} EM ATRASO!
                  </p>
                  <p style={{ fontSize: 12, color: '#fecaca', marginTop: 2, lineHeight: 1.4 }}>
                    Regularize seu pagamento imediatamente. Entre em contato com o coordenador ou compareça presencialmente.
                  </p>
                </div>
                <button onClick={() => setActiveTab('financeiro')}
                  style={{ flexShrink: 0, background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Ver Detalhes
                </button>
              </div>
            </div>
          );
        }
        if (pendentes.length > 0) {
          return (
            <div style={{ background: '#78350f', borderBottom: '3px solid #d97706', padding: '10px 16px' }}>
              <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock size={16} style={{ color: '#ffffff' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: '#fde68a', lineHeight: 1.2 }}>
                    Atenção: {pendentes.length} mensalidade{pendentes.length > 1 ? 's' : ''} pendente{pendentes.length > 1 ? 's' : ''}
                  </p>
                  <p style={{ fontSize: 12, color: '#fef3c7', marginTop: 1 }}>
                    Regularize seu pagamento para evitar atrasos.
                  </p>
                </div>
                <button onClick={() => setActiveTab('financeiro')}
                  style={{ flexShrink: 0, background: '#d97706', color: '#ffffff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Ver Detalhes
                </button>
              </div>
            </div>
          );
        }
        return null;
      })()}

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>

        {/* ══ TAB: INÍCIO ══════════════════════════════════════ */}
        {activeTab === 'inicio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Hero */}
            <div className="portal-card" style={{ background: `linear-gradient(135deg, ${T.blueDark} 0%, #1e40af 60%, #2563eb 100%)`, border: 'none', padding: 28, position: 'relative', overflow: 'hidden', boxShadow: '0 4px 20px rgba(30,58,138,0.25)' }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
              <div style={{ position: 'absolute', bottom: -30, right: 60, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginBottom: 6 }}>Bem-vindo de volta,</p>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: '#ffffff', marginBottom: 10, lineHeight: 1.2 }}>{session.nome}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                  <Hash size={12} /><span>Matrícula: <strong style={{ color: '#ffffff', fontFamily: 'monospace' }}>{session.matricula}</strong></span>
                </div>
                {session.turmaNome && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                    <BookOpen size={12} /><span>Turma: <strong style={{ color: '#ffffff' }}>{session.turmaNome}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div className="portal-card" style={{ padding: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 24, fontWeight: 800, color: T.blue, marginBottom: 4 }}>{notas.length}</p>
                <p style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>DISCIPLINAS</p>
              </div>
              <div className="portal-card" style={{ padding: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 24, fontWeight: 800, color: mediaGeral !== null ? (mediaGeral >= 7 ? T.green : mediaGeral >= 5 ? T.amber : T.red) : T.textFaint, marginBottom: 4 }}>
                  {mediaGeral !== null ? mediaGeral.toFixed(1) : '—'}
                </p>
                <p style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>MÉDIA GERAL</p>
              </div>
              <div className="portal-card" style={{ padding: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 24, fontWeight: 800, color: T.blue, marginBottom: 4 }}>{arquivos.length}</p>
                <p style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>DOCUMENTOS</p>
              </div>
            </div>

            {/* Next class */}
            {nextEvento && (
              <div className="portal-card-blue" style={{ padding: 18 }}>
                <p style={{ fontSize: 11, color: T.blue, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Próxima Aula</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: T.blueLight, border: `1px solid ${T.cardBorderBlue}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CalendarDays size={22} style={{ color: T.blue }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 3 }}>{nextEvento.disciplina}</p>
                    <p style={{ fontSize: 12, color: T.textSec }}>
                      {new Date(nextEvento.data_aula + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} • {nextEvento.professor}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Financial summary */}
            {mensalidades.length > 0 && (() => {
              const recent = mensalidades.slice(0, 3);
              const temAtrasado = recent.some(m => m.situacao === 'Atrasado');
              const temPendente = recent.some(m => m.situacao !== 'Pago');
              return (
                <div className="portal-card" style={{ padding: 18, border: temAtrasado ? `1px solid ${T.redBorder}` : `1px solid ${T.cardBorder}`, background: temAtrasado ? T.redBg : T.white }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: temAtrasado ? T.red : T.blue, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CreditCard size={13} />Situação Financeira
                    </p>
                    <button onClick={() => setActiveTab('financeiro')} style={{ fontSize: 11, color: T.textMuted, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                      Ver todos <ChevronRight size={11} />
                    </button>
                  </div>
                  {temAtrasado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: T.redBg, border: `1px solid ${T.redBorder}`, marginBottom: 12 }}>
                      <AlertTriangle size={14} style={{ color: T.red, flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: T.red, fontWeight: 600 }}>Atenção: há mensalidade(s) em atraso. Contacte o coordenador.</p>
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
                          <p style={{ fontSize: 13, color: T.textSec }}>{mesNome}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {m.valor > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: T.textSec, fontFamily: 'monospace' }}>R$ {m.valor.toFixed(2).replace('.',',')}</span>}
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: isPago ? T.greenBg : isAtrasado ? T.redBg : T.amberBg, color: isPago ? T.green : isAtrasado ? T.red : T.amber, border: `1px solid ${isPago ? T.greenBorder : isAtrasado ? T.redBorder : T.amberBorder}` }}>
                              {isPago && <CheckCircle size={9} style={{ display: 'inline', marginRight: 3 }} />}{m.situacao}
                            </span>
                            {m.comprovante_url && (
                              <a href={m.comprovante_url} target="_blank" rel="noopener noreferrer" style={{ color: T.blue, display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                                <ExternalLink size={11} />PDF
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {temPendente && !temAtrasado && (
                    <p style={{ fontSize: 11, color: T.textFaint, marginTop: 10, textAlign: 'center' }}>Regularize seu pagamento pelo PIX ou presencialmente</p>
                  )}
                </div>
              );
            })()}

            {/* Navigation cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[
                { id: 'notas' as const, icon: BookOpen, label: 'Minhas Notas', desc: `${notas.length} disciplinas`, color: T.blue, bg: T.blueLight },
                { id: 'calendario' as const, icon: CalendarDays, label: 'Calendário', desc: nextEvento ? 'Próxima aula agendada' : 'Ver agenda', color: '#7c3aed', bg: '#f5f3ff' },
                { id: 'financeiro' as const, icon: DollarSign, label: 'Financeiro', desc: `${mensalidades.filter(m => m.situacao === 'Pago').length} pago${mensalidades.filter(m => m.situacao === 'Pago').length !== 1 ? 's' : ''}`, color: T.green, bg: T.greenBg },
                { id: 'ficha' as const, icon: User, label: 'Minha Ficha', desc: 'Dados pessoais', color: '#0891b2', bg: '#ecfeff' },
                { id: 'documentos' as const, icon: FileText, label: 'Documentos', desc: `${arquivos.length} arquivo${arquivos.length !== 1 ? 's' : ''}`, color: '#ea580c', bg: '#fff7ed' },
              ].map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)} className="portal-card"
                  style={{ padding: 18, textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', display: 'block', width: '100%', border: `1px solid ${T.cardBorder}` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = T.shadowMd; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = T.shadow; }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <item.icon size={20} style={{ color: item.color }} />
                  </div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 3 }}>{item.label}</p>
                  <p style={{ fontSize: 12, color: T.textMuted }}>{item.desc}</p>
                </button>
              ))}
            </div>

            {/* Loja do Aluno CTA */}
            <button onClick={() => navigate('/loja')}
              style={{ width: '100%', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', borderRadius: 16, padding: '18px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 4px 16px rgba(124,58,237,0.3)', transition: 'all 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(124,58,237,0.45)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(124,58,237,0.3)'; }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShoppingBag size={24} style={{ color: '#ffffff' }} />
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <p style={{ fontWeight: 800, fontSize: 16, color: '#ffffff', marginBottom: 2 }}>Loja do Aluno</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>Apostilas, materiais e produtos disponíveis</p>
              </div>
              <ChevronRight size={20} style={{ color: 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
            </button>

            {/* Observações / Reclamações */}
            <div className="portal-card" style={{ padding: 20 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: T.text, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <MessageCircle size={15} style={{ color: T.blue }} />Fale com o Coordenador
              </p>
              <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 14 }}>Dúvidas, reclamações, sugestões ou observações para o coordenador</p>
              <textarea value={novaMensagem} onChange={e => setNovaMensagem(e.target.value)}
                placeholder="Escreva aqui sua mensagem para o coordenador..."
                rows={3} className="portal-input"
                style={{ resize: 'vertical', minHeight: 80, fontFamily: 'inherit', lineHeight: 1.5 }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button onClick={handleSendObservacao} disabled={sendingObs || !novaMensagem.trim()}
                  className="gold-btn" style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  {sendingObs ? <Spinner color="#fff" /> : <Send size={13} />}
                  {sendingObs ? 'Enviando...' : 'Enviar Mensagem'}
                </button>
              </div>
              {observacoes.length > 0 && (
                <div style={{ marginTop: 16, borderTop: `1px solid ${T.cardBorder}`, paddingTop: 14 }}>
                  <p style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mensagens enviadas</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {observacoes.slice(0, 5).map(o => (
                      <div key={o.id} style={{ borderRadius: 10, border: `1px solid ${o.resposta ? T.greenBorder : T.cardBorder}`, overflow: 'hidden' }}>
                        {/* Student message */}
                        <div style={{ padding: '10px 14px', background: T.inputBg }}>
                          <p style={{ fontSize: 12, color: T.textSec, lineHeight: 1.5, marginBottom: 4 }}>{o.mensagem}</p>
                          <p style={{ fontSize: 10, color: T.textFaint, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {new Date(o.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {o.resposta
                              ? <span style={{ color: T.green, display: 'flex', alignItems: 'center', gap: 3 }}><CheckCircle size={9} />Respondida pelo coordenador</span>
                              : o.lida
                              ? <span style={{ color: T.textMuted }}>• Lida pelo coordenador</span>
                              : <span style={{ color: T.amber }}>• Aguardando leitura</span>
                            }
                          </p>
                        </div>
                        {/* Coordinator reply */}
                        {o.resposta && (
                          <div style={{ padding: '10px 14px', background: T.greenBg, borderTop: `1px solid ${T.greenBorder}` }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: T.green, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MessageCircle size={10} />Resposta do Coordenador
                              {o.respondida_em && <span style={{ fontWeight: 400, color: T.textMuted, marginLeft: 4 }}>
                                — {new Date(o.respondida_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>}
                            </p>
                            <p style={{ fontSize: 12, color: '#166534', lineHeight: 1.5 }}>{o.resposta}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ TAB: NOTAS ════════════════════════════════════════ */}
        {activeTab === 'notas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Motivational banner */}
            {mediaGeral !== null && (() => {
              const isGreat = mediaGeral >= 8;
              const isGood = mediaGeral >= 7;
              const bg = isGreat ? T.greenBg : isGood ? T.blueLight : T.amberBg;
              const border = isGreat ? T.greenBorder : isGood ? T.cardBorderBlue : T.amberBorder;
              const iconEl = isGreat ? <Award size={22} style={{ color: T.green }} /> : isGood ? <TrendingUp size={22} style={{ color: T.blue }} /> : <AlertTriangle size={22} style={{ color: T.amber }} />;
              const textColor = isGreat ? T.green : isGood ? T.blue : T.amber;
              const msg = isGreat
                ? `Parabéns, ${session.nome.split(' ')[0]}! Sua média ${mediaGeral.toFixed(1)} é excelente! Continue assim!`
                : isGood
                ? `Ótimo, ${session.nome.split(' ')[0]}! Média ${mediaGeral.toFixed(1)} — você bateu a média! Continue firme!`
                : `Atenção, ${session.nome.split(' ')[0]}! Média ${mediaGeral.toFixed(1)} — dedique-se mais para alcançar a nota 10!`;
              return (
                <div className="portal-card" style={{ background: bg, border: `1px solid ${border}`, padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start', boxShadow: 'none' }}>
                  <div style={{ flexShrink: 0, marginTop: 1 }}>{iconEl}</div>
                  <p style={{ fontSize: 14, color: textColor, fontWeight: 600, lineHeight: 1.5 }}>{msg}</p>
                </div>
              );
            })()}

            {/* Header */}
            <div className="portal-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 15, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <GraduationCap size={16} style={{ color: T.blue }} />Situação Escolar Parcial
                  </h3>
                  <p style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                    {session.nome} — <span style={{ fontFamily: 'monospace' }}>{session.matricula}</span>
                  </p>
                </div>
                {session.turmaNome && (
                  <span style={{ fontSize: 11, background: T.blueLight, color: T.blue, padding: '4px 10px', borderRadius: 20, border: `1px solid ${T.cardBorderBlue}`, fontWeight: 600 }}>{session.turmaNome}</span>
                )}
              </div>
            </div>

            {loadingNotas ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div className="loading-spinner" style={{ margin: '0 auto', borderColor: T.cardBorder, borderTopColor: T.blue }} />
              </div>
            ) : notas.length === 0 ? (
              <div className="portal-card" style={{ padding: 48, textAlign: 'center', color: T.textMuted }}>
                <BookOpen size={40} style={{ margin: '0 auto 12px', opacity: 0.3, color: T.textMuted }} />
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
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: T.textFaint, width: 24, textAlign: 'center', flexShrink: 0 }}>{n.disciplina_numero}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: 14, color: T.text }}>{n.disciplina_nome}</p>
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, fontSize: 11, color: T.textMuted, flexWrap: 'wrap' }}>
                {[[T.green,'Excelente 8–10'], [T.blue,'Aprovado 7'], [T.amber,'Exame 5–6'], [T.red,'Reprovado <5']].map(([c, l]) => (
                  <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: CALENDÁRIO ══════════════════════════════════ */}
        {activeTab === 'calendario' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="portal-card" style={{ padding: '20px 24px', background: `linear-gradient(135deg, ${T.blueDark}, ${T.blueMid})`, border: 'none', textAlign: 'center', boxShadow: '0 4px 16px rgba(30,58,138,0.2)' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4 }}>Segue o calendário das próximas aulas,</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#ffffff' }}>se organizem!</p>
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
                <div className="portal-card" style={{ padding: 48, textAlign: 'center', color: T.textMuted }}>
                  <CalendarDays size={40} style={{ margin: '0 auto 12px', opacity: 0.3, color: T.textMuted }} /><p>Nenhum evento cadastrado</p>
                </div>
              );
              return Object.entries(groups).map(([key, evs]) => {
                const [year, month] = key.split('-').map(Number);
                const isPast = new Date(year, month, 0) < today;
                return (
                  <div key={key} style={{ opacity: isPast ? 0.5 : 1, filter: isPast ? 'grayscale(0.4)' : 'none', transition: 'all 0.3s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Clock size={16} style={{ color: isPast ? T.textMuted : T.blue }} />
                      <span style={{ fontWeight: 800, fontSize: 15, color: isPast ? T.textMuted : T.text, letterSpacing: '0.05em' }}>
                        {MESES_PT[month-1].toUpperCase()} {year}
                      </span>
                      {isPast && <span style={{ fontSize: 10, color: T.textMuted, background: T.inputBg, padding: '2px 8px', borderRadius: 10, fontWeight: 600, border: `1px solid ${T.cardBorder}` }}>PASSADO</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                      {evs.map(ev => {
                        const d = new Date(ev.data_aula + 'T00:00:00');
                        const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        return (
                          <div key={ev.id} className={isPast ? 'portal-card' : 'portal-card-blue'} style={{ padding: 16 }}>
                            <p style={{ fontSize: 11, fontFamily: 'monospace', color: isPast ? T.textMuted : T.blue, fontWeight: 600, marginBottom: 10 }}>{dateStr}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 8, background: T.blueLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span style={{ fontWeight: 800, fontSize: 12, color: T.blue }}>{ev.professor.charAt(0)}</span>
                              </div>
                              <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{ev.professor}</span>
                            </div>
                            <p style={{ fontSize: 13, color: T.textSec, marginBottom: ev.obs ? 12 : 0 }}>{ev.disciplina}</p>
                            {ev.obs && (
                              <div style={{ background: T.amberBg, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: 12 }}>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
                                  <AlertTriangle size={13} style={{ color: T.amber, flexShrink: 0, marginTop: 1 }} />
                                  <span style={{ fontSize: 10, fontWeight: 800, color: T.amber, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Observação:</span>
                                </div>
                                <p style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>{ev.obs}</p>
                                {ev.provas_disciplinas && (
                                  <p style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.amber, display: 'inline-block', flexShrink: 0 }} />{ev.provas_disciplinas}
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

        {/* ══ TAB: FINANCEIRO ══════════════════════════════════ */}
        {activeTab === 'financeiro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── PIX Payment Section (clean-panel-faq layout) ── */}
            <div className="portal-card" style={{ padding: '32px 28px', overflow: 'hidden' }}>
              {/* hidden file input for comprovante */}
              <input ref={mensCompRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleStudentComprovante} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                {/* Top: badge + heading */}
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${T.blueFaint}`, border: `1px solid ${T.cardBorderBlue}`, borderRadius: 999, padding: '6px 14px', marginBottom: 16 }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, background: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <QrCode size={11} style={{ color: '#fff' }} />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.blue }}>Pagamento via PIX</span>
                  </div>
                  <h2 style={{ fontSize: 32, fontWeight: 700, color: T.text, lineHeight: 1.25, marginBottom: 8 }}>
                    Pague sua mensalidade<br />
                    <span style={{ color: T.blue }}>com PIX</span>
                  </h2>
                  <p style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6, maxWidth: 440 }}>
                    Escaneie o QR Code ou copie a chave PIX abaixo. Após o pagamento, envie o comprovante diretamente pelo portal.
                  </p>
                </div>

                {/* Two-column: QR + Key | FAQ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Row 1: QR + key side by side on desktop */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                    {/* QR Code box */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 20, borderRadius: 20, border: `2px solid ${T.cardBorderBlue}`, background: T.white, minWidth: 180, boxShadow: '0 2px 12px rgba(37,99,235,0.08)' }}>
                      <div style={{ padding: 10, borderRadius: 12, background: T.white, border: `1px solid ${T.cardBorder}` }}>
                        <QRCodeSVG value={PIX_EMV} size={148} level="M" />
                      </div>
                      <p style={{ fontSize: 11, color: T.textMuted, textAlign: 'center', lineHeight: 1.4 }}>Escaneie com o app do seu banco</p>
                    </div>

                    {/* Key + copy */}
                    <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Chave PIX (CNPJ)</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.inputBg, border: `1.5px solid ${T.cardBorderBlue}`, borderRadius: 12, padding: '10px 14px' }}>
                          <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: '0.04em' }}>{PIX_DISPLAY}</span>
                          <button
                            onClick={() => { navigator.clipboard.writeText(PIX_DISPLAY); toast.success('Chave PIX copiada!'); }}
                            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, background: T.blue, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            <Copy size={12} />Copiar
                          </button>
                        </div>
                      </div>
                      <div style={{ padding: '12px 14px', borderRadius: 12, background: T.blueLight, border: `1px solid ${T.cardBorderBlue}` }}>
                        <p style={{ fontSize: 12, color: T.blueDark, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <AlertCircle size={13} />Instruções
                        </p>
                        <ol style={{ fontSize: 12, color: T.textSec, lineHeight: 1.8, paddingLeft: 16, margin: 0 }}>
                          <li>Abra o app do seu banco e acesse o PIX</li>
                          <li>Escaneie o QR Code ou cole a chave CNPJ</li>
                          <li>Informe o valor da sua mensalidade</li>
                          <li>Confirme e envie o comprovante abaixo</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  {/* FAQ Accordion */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Dúvidas frequentes</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {FAQ_PIX.map(item => {
                        const isOpen = openFaq === item.id;
                        return (
                          <div key={item.id} style={{ borderRadius: 16, border: `1px solid ${isOpen ? T.cardBorderBlue : T.cardBorder}`, background: isOpen ? T.white : '#f9fafb', overflow: 'hidden', transition: 'all 0.2s', boxShadow: isOpen ? '0 2px 10px rgba(37,99,235,0.08)' : 'none' }}>
                            <button
                              onClick={() => setOpenFaq(isOpen ? null : item.id)}
                              style={{ width: '100%', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12 }}>
                              <span style={{ fontWeight: 600, fontSize: 14, color: isOpen ? T.blue : T.text }}>{item.q}</span>
                              <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                                {isOpen
                                  ? <ChevronUpIcon size={14} style={{ color: '#fff' }} />
                                  : <ChevronDown size={14} style={{ color: '#fff' }} />}
                              </span>
                            </button>
                            {isOpen && (
                              <div style={{ padding: '0 18px 14px' }}>
                                <div style={{ height: 1, background: `${T.blue}30`, marginBottom: 12, borderRadius: 2 }} />
                                <p style={{ fontSize: 13, color: T.textSec, lineHeight: 1.65 }}>{item.a}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Stats ── */}
            {mensalidades.length > 0 && (() => {
              const pagos = mensalidades.filter(m => m.situacao === 'Pago');
              const pendentes = mensalidades.filter(m => m.situacao !== 'Pago' && m.situacao !== 'Atrasado');
              const atrasados = mensalidades.filter(m => m.situacao === 'Atrasado');
              const totalPago = pagos.reduce((s, m) => s + m.valor, 0);
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div className="portal-card" style={{ padding: 14, textAlign: 'center' }}>
                    <p style={{ fontSize: 20, fontWeight: 800, color: T.green }}>{pagos.length}</p>
                    <p style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, marginTop: 2 }}>PAGAS</p>
                    {totalPago > 0 && <p style={{ fontSize: 11, color: T.green, marginTop: 2, fontFamily: 'monospace' }}>R$ {totalPago.toFixed(2).replace('.',',')}</p>}
                  </div>
                  <div className="portal-card" style={{ padding: 14, textAlign: 'center' }}>
                    <p style={{ fontSize: 20, fontWeight: 800, color: T.amber }}>{pendentes.length}</p>
                    <p style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, marginTop: 2 }}>PENDENTES</p>
                  </div>
                  <div className="portal-card" style={{ padding: 14, textAlign: 'center' }}>
                    <p style={{ fontSize: 20, fontWeight: 800, color: atrasados.length > 0 ? T.red : T.textFaint }}>{atrasados.length}</p>
                    <p style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, marginTop: 2 }}>ATRASADAS</p>
                  </div>
                </div>
              );
            })()}

            {/* ── Mensalidades list ── */}
            {mensalidades.length === 0 ? (
              <div className="portal-card" style={{ padding: 48, textAlign: 'center', color: T.textMuted }}>
                <DollarSign size={40} style={{ margin: '0 auto 12px', opacity: 0.3, color: T.textMuted }} />
                <p style={{ fontWeight: 600 }}>Nenhum lançamento financeiro</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Os pagamentos serão registrados pelo coordenador</p>
              </div>
            ) : (
              <div className="portal-card" style={{ overflow: 'hidden' }}>
                {mensalidades.map((m, i) => {
                  const [y, mo] = m.mes.split('-');
                  const mesNome = `${MESES_PT[parseInt(mo)-1]} ${y}`;
                  const isPago = m.situacao === 'Pago';
                  const isAtrasado = m.situacao === 'Atrasado';
                  const isUploading = uploadingMensId === m.id;
                  return (
                    <div key={m.id} style={{ borderBottom: i < mensalidades.length - 1 ? `1px solid ${T.cardBorder}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', transition: 'background 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = T.inputBg; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: isPago ? T.greenBg : isAtrasado ? T.redBg : T.amberBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {isPago ? <CheckCircle size={18} style={{ color: T.green }} /> : isAtrasado ? <AlertTriangle size={18} style={{ color: T.red }} /> : <Clock size={18} style={{ color: T.amber }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{mesNome}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                            {m.forma_pagamento && <span style={{ fontSize: 11, color: T.textMuted }}>{m.forma_pagamento}</span>}
                            {m.obs && <span style={{ fontSize: 11, color: T.textMuted }}>• {m.obs}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {m.valor > 0 && (
                            <span style={{ fontSize: 14, fontWeight: 700, color: T.textSec, fontFamily: 'monospace' }}>R$ {m.valor.toFixed(2).replace('.',',')}</span>
                          )}
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: isPago ? T.greenBg : isAtrasado ? T.redBg : T.amberBg, color: isPago ? T.green : isAtrasado ? T.red : T.amber, border: `1px solid ${isPago ? T.greenBorder : isAtrasado ? T.redBorder : T.amberBorder}`, minWidth: 68, textAlign: 'center' }}>
                            {m.situacao}
                          </span>
                          {m.comprovante_url && (
                            <a href={m.comprovante_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: T.blue, fontWeight: 600 }}>
                              <ExternalLink size={13} />Ver
                            </a>
                          )}
                          {!isPago && (
                            <button
                              disabled={isUploading}
                              onClick={() => { pendingMensIdRef.current = m.id; mensCompRef.current?.click(); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: T.blue, background: T.blueLight, border: `1px solid ${T.cardBorderBlue}`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer', opacity: isUploading ? 0.6 : 1 }}>
                              {isUploading ? <Spinner color={T.blue} /> : <UploadIcon size={12} />}
                              {isUploading ? 'Enviando...' : m.comprovante_url ? 'Reenviar' : 'Comprovante'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p style={{ fontSize: 11, color: T.textFaint, textAlign: 'center', padding: '0 8px' }}>
              Os valores são gerenciados pelo coordenador. Em caso de divergência, use o campo "Fale com o Coordenador" na página inicial.
            </p>
          </div>
        )}

        {/* ══ TAB: MINHA FICHA ══════════════════════════════════ */}
        {activeTab === 'ficha' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Section title="Dados Escolares" icon={<Hash size={15} style={{ color: T.blue }} />}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <ReadField label="Matrícula" value={session.matricula} mono />
                <ReadField label="Turma" value={session.turmaNome || '—'} />
                <ReadField label="Nome" value={session.nome} />
              </div>
            </Section>

            <Section title="Dados Pessoais" icon={<User size={15} style={{ color: T.blue }} />}>
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
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: T.textSec, textTransform: 'uppercase', marginBottom: 6 }}>Sexo</label>
                  <Select value={profile.sexo || 'none'} onValueChange={v => setP('sexo', v === 'none' ? '' : v)}>
                    <SelectTrigger className="portal-input" style={{ height: 'auto', background: T.inputBg, border: `1.5px solid ${T.cardBorderBlue}`, color: T.text, borderRadius: 12 }}>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent><SelectItem value="none">—</SelectItem><SelectItem value="Masculino">Masculino</SelectItem><SelectItem value="Feminino">Feminino</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: T.textSec, textTransform: 'uppercase', marginBottom: 6 }}>Estado Civil</label>
                  <Select value={profile.estado_civil || 'none'} onValueChange={v => setP('estado_civil', v === 'none' ? '' : v)}>
                    <SelectTrigger className="portal-input" style={{ height: 'auto', background: T.inputBg, border: `1.5px solid ${T.cardBorderBlue}`, color: T.text, borderRadius: 12 }}>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem><SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                      <SelectItem value="Casado(a)">Casado(a)</SelectItem><SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                      <SelectItem value="Viúvo(a)">Viúvo(a)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <PortalInput label="Profissão" value={profile.profissao} onChange={v => setP('profissao', v)} placeholder="Profissão" />
              </div>
            </Section>

            <Section title="Contato" icon={<Phone size={15} style={{ color: T.blue }} />}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <PortalInput label="Celular Principal" value={profile.celular1} onChange={v => setP('celular1', v)} placeholder="(00) 00000-0000" />
                <PortalInput label="Celular Secundário" value={profile.celular2} onChange={v => setP('celular2', v)} placeholder="(00) 00000-0000" />
                <PortalInput label="E-mail" type="email" value={alunoEmail} onChange={setAlunoEmail} placeholder="email@exemplo.com" />
                <PortalInput label="E-mail Alternativo" type="email" value={profile.email_contato} onChange={v => setP('email_contato', v)} placeholder="email@exemplo.com" />
              </div>
            </Section>

            <Section title="Endereço" icon={<MapPin size={15} style={{ color: T.blue }} />}>
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

            <Section title="Igreja" icon={<Building2 size={15} style={{ color: T.blue }} />}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <PortalInput label="Congregação" value={profile.congregacao} onChange={v => setP('congregacao', v)} placeholder="Nome da congregação" />
                <PortalInput label="Igreja Membro" value={profile.igreja_membro} onChange={v => setP('igreja_membro', v)} placeholder="Igreja" />
                <PortalInput label="Função na Igreja" value={profile.funcao_igreja} onChange={v => setP('funcao_igreja', v)} placeholder="Pastor, Diácono..." />
                <PortalInput label="Data Conversão" type="date" value={profile.data_conversao} onChange={v => setP('data_conversao', v)} />
                <PortalInput label="Data Batismo" type="date" value={profile.data_batismo} onChange={v => setP('data_batismo', v)} />
              </div>
            </Section>

            <Section title="Família e Formação" icon={<Heart size={15} style={{ color: T.blue }} />}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <PortalInput label="Nome do Pai" value={profile.nome_pai} onChange={v => setP('nome_pai', v)} placeholder="Nome do pai" />
                <PortalInput label="Nome da Mãe" value={profile.nome_mae} onChange={v => setP('nome_mae', v)} placeholder="Nome da mãe" />
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: T.textSec, textTransform: 'uppercase', marginBottom: 6 }}>Nível de Formação</label>
                  <Select value={profile.nivel_formacao || 'none'} onValueChange={v => setP('nivel_formacao', v === 'none' ? '' : v)}>
                    <SelectTrigger className="portal-input" style={{ height: 'auto', background: T.inputBg, border: `1.5px solid ${T.cardBorderBlue}`, color: T.text, borderRadius: 12 }}>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem><SelectItem value="Fundamental">Fundamental</SelectItem>
                      <SelectItem value="Médio">Médio</SelectItem><SelectItem value="Superior">Superior</SelectItem>
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
                {savingProfile ? <Spinner color="#fff" /> : <Save size={15} />}
                {savingProfile ? 'Salvando...' : 'Salvar Informações'}
              </button>
            </div>
          </div>
        )}

        {/* ══ TAB: DOCUMENTOS ══════════════════════════════════ */}
        {activeTab === 'documentos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="portal-card" style={{ padding: 20 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: T.text, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={15} style={{ color: T.blue }} />Enviar Documento
              </p>
              <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>
                Certificados, comprovantes, declarações e outros documentos pessoais (máx 20 MB)
              </p>
              <input ref={fileRef} type="file" id="file-upload" onChange={handleUploadFile} className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" />
              <label htmlFor="file-upload" style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: 100, border: `2px dashed ${T.cardBorderBlue}`, borderRadius: 14, cursor: uploading ? 'wait' : 'pointer',
                transition: 'all 0.2s', opacity: uploading ? 0.5 : 1, background: T.inputBg
              }}
                onMouseEnter={e => { if (!uploading) { (e.currentTarget as HTMLLabelElement).style.borderColor = T.blue; (e.currentTarget as HTMLLabelElement).style.background = T.blueLight; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = T.cardBorderBlue; (e.currentTarget as HTMLLabelElement).style.background = T.inputBg; }}>
                {uploading ? <div className="loading-spinner" style={{ borderColor: T.cardBorder, borderTopColor: T.blue }} /> : (
                  <>
                    <Upload size={22} style={{ color: T.textMuted, marginBottom: 8 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.textSec }}>Clique para selecionar arquivo</span>
                    <span style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>PDF, DOC, JPG, PNG</span>
                  </>
                )}
              </label>
            </div>

            <div className="portal-card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.cardBorder}` }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={15} style={{ color: T.blue }} />Meus Documentos
                  {arquivos.length > 0 && <span style={{ fontSize: 11, background: T.blueLight, color: T.blue, padding: '2px 8px', borderRadius: 20, border: `1px solid ${T.cardBorderBlue}`, fontWeight: 600 }}>{arquivos.length}</span>}
                </p>
              </div>
              {arquivos.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: T.textMuted }}>
                  <FileText size={36} style={{ margin: '0 auto 10px', opacity: 0.3, color: T.textMuted }} />
                  <p style={{ fontWeight: 600, fontSize: 13 }}>Nenhum documento enviado</p>
                </div>
              ) : (
                <div>
                  {arquivos.map(arq => (
                    <div key={arq.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${T.cardBorder}`, transition: 'background 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = T.inputBg; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: T.blueLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={16} style={{ color: T.blue }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{arq.nome_arquivo}</p>
                        <p style={{ fontSize: 11, color: T.textMuted }}>
                          {new Date(arq.uploaded_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <a href={arq.url} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: T.blueLight, color: T.blue, transition: 'all 0.15s', textDecoration: 'none' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = T.cardBorderBlue; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = T.blueLight; }}>
                          <Download size={14} />
                        </a>
                        <button onClick={() => handleDeleteArquivo(arq)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: T.redBg, color: T.red, border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.redBorder; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = T.redBg; }}>
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }`}</style>
    </div>
  );
}

/* ─── Helper sub-components ─────────────────────────────────── */
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="portal-card" style={{ padding: 20 }}>
      <p style={{ fontWeight: 700, fontSize: 14, color: '#1e2d5a', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {icon}{title}
      </p>
      {children}
    </div>
  );
}

function ReadField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</p>
      <p style={{ fontWeight: 600, fontSize: 14, color: '#1e2d5a', fontFamily: mono ? 'monospace' : undefined }}>{value || '—'}</p>
    </div>
  );
}
