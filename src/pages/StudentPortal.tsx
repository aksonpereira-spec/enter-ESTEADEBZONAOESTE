import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeSVG } from 'qrcode.react';
import {
  LogOut, User, CreditCard, FileText, CheckCircle2, Clock,
  Upload, Trash2, Eye, BookOpen, ChevronRight, GraduationCap, Save,
  AlertCircle, Check, Copy, QrCode,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── PIX utils ───────────────────────────────────────────────────────────────
const PIX_CNPJ = '40800393000132'; // 40.800.393/0001-32
const PIX_KEY_DISPLAY = '40.800.393/0001-32';
const PIX_NAME = 'ESTEADEB ZO';
const PIX_CITY = 'SAO PAULO';

function crc16ccitt(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`;
}

function generatePixCode(): string {
  const gui = tlv('00', 'BR.GOV.BCB.PIX');
  const key = tlv('01', PIX_CNPJ);
  const merchantInfo = tlv('26', gui + key);
  const additionalData = tlv('62', tlv('05', '***'));
  const payload = tlv('00', '01') + merchantInfo + tlv('52', '0000') + tlv('53', '986') +
    tlv('58', 'BR') + tlv('59', PIX_NAME) + tlv('60', PIX_CITY) + additionalData + '6304';
  return payload + crc16ccitt(payload);
}

const PIX_PAYLOAD = generatePixCode();

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const mesLabel = (m: string) => { const [y, mo] = m.split('-'); return `${MONTHS[parseInt(mo)-1]} ${y}`; };

const DOCUMENTOS = [
  { tipo: 'foto3x4', label: 'Foto 3x4', accept: 'image/*' },
  { tipo: 'identidade', label: 'Identidade (RG/CNH)', accept: 'image/*,application/pdf' },
  { tipo: 'certidao', label: 'Certidão de Nascimento/Casamento', accept: 'image/*,application/pdf' },
  { tipo: 'comprovante_residencia', label: 'Comprovante de Residência', accept: 'image/*,application/pdf' },
  { tipo: 'comprovante_escolaridade', label: 'Comprovante de Escolaridade', accept: 'image/*,application/pdf' },
  { tipo: 'carta_recomendacao', label: 'Carta de Recomendação', accept: 'image/*,application/pdf' },
];

type Tab = 'ficha' | 'financeiro' | 'documentos';

interface Mensalidade {
  id: string; mes: string; situacao: string;
  dinheiro: number; pixDeposito: number; cartaoAssinatura: number; cartaoDebito: number;
  valor: number; obs: string; apostilas: string; qtdApostilas: number;
}

interface DocItem { id: string; tipo: string; nome_arquivo: string; url: string; storage_path: string; uploaded_at: string; }

type ProfileForm = {
  nome_completo: string; sexo: string; estado_civil: string; data_nascimento: string;
  cidade_nascimento: string; uf_nascimento: string; rg: string; cpf: string; orgao_expedidor: string;
  endereco: string; bairro: string; cep: string; cidade: string; uf: string;
  telefone: string; celular1: string; celular2: string; email_contato: string;
  nome_pai: string; nome_mae: string; profissao: string;
  data_conversao: string; data_batismo: string; igreja_membro: string; congregacao: string; funcao_igreja: string;
  nivel_formacao: string; carga_horaria: string; instituicao: string; ano_termino: string;
  habilidades: string;
};

const emptyProfile: ProfileForm = {
  nome_completo: '', sexo: '', estado_civil: '', data_nascimento: '',
  cidade_nascimento: '', uf_nascimento: '', rg: '', cpf: '', orgao_expedidor: '',
  endereco: '', bairro: '', cep: '', cidade: '', uf: '',
  telefone: '', celular1: '', celular2: '', email_contato: '',
  nome_pai: '', nome_mae: '', profissao: '',
  data_conversao: '', data_batismo: '', igreja_membro: '', congregacao: '', funcao_igreja: '',
  nivel_formacao: '', carga_horaria: '', instituicao: '', ano_termino: '', habilidades: '',
};

const StudentPortal = () => {
  const { logout, studentName, studentId, studentAuthId } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('ficha');
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [loadingMens, setLoadingMens] = useState(false);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [nucleoNome, setNucleoNome] = useState('Zona Oeste');
  const [localAlunoId, setLocalAlunoId] = useState<string | null>(null);
  const [alunoMatricula, setAlunoMatricula] = useState<string>('');
  const [pixCopied, setPixCopied] = useState(false);

  const activeAlunoId = localAlunoId || studentId;

  const generateMatricula = async (ano: number): Promise<string> => {
    const prefix = String(ano);
    const { data } = await supabase.from('alunos').select('matricula').ilike('matricula', `${prefix}%`);
    const nums = (data || []).map(r => parseInt((r.matricula || '').replace(prefix, ''), 10)).filter(n => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `${prefix}${String(next).padStart(3, '0')}`;
  };

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_KEY_DISPLAY);
      setPixCopied(true);
      toast.success('Chave PIX copiada!');
      setTimeout(() => setPixCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  useEffect(() => {
    // Load nucleo config
    supabase.from('nucleo_config').select('nome_nucleo').limit(1).maybeSingle().then(({ data }) => {
      if (data?.nome_nucleo) setNucleoNome(data.nome_nucleo);
    });
    // Load profile
    if (studentAuthId) loadProfile();
    // Load mensalidades
    const alunoId = localAlunoId || studentId;
    if (alunoId) loadMensalidades(alunoId);
    // Load documents
    if (studentAuthId) loadDocuments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentAuthId, studentId, localAlunoId]);

  // Init localAlunoId from context
  useEffect(() => {
    if (studentId && !localAlunoId) setLocalAlunoId(studentId);
  }, [studentId, localAlunoId]);

  // Load aluno matricula when activeAlunoId changes
  useEffect(() => {
    if (activeAlunoId) {
      supabase.from('alunos').select('matricula').eq('id', activeAlunoId).maybeSingle().then(({ data }) => {
        if (data?.matricula) setAlunoMatricula(data.matricula);
      });
    }
  }, [activeAlunoId]);

  const loadProfile = async () => {
    const { data } = await supabase.from('student_profiles').select('*').eq('auth_user_id', studentAuthId!).maybeSingle();
    if (data) {
      setProfileId(data.id);
      const p: ProfileForm = { ...emptyProfile };
      for (const key of Object.keys(emptyProfile) as (keyof ProfileForm)[]) {
        if (key in data) p[key] = (data as Record<string, string>)[key] ?? '';
      }
      setProfile(p);
    }
  };

  const loadMensalidades = async (alunoId: string) => {
    setLoadingMens(true);
    const { data } = await supabase.from('mensalidades').select('*').eq('aluno_id', alunoId).order('mes');
    if (data) setMensalidades(data.map(r => ({
      id: r.id, mes: r.mes, situacao: r.situacao,
      dinheiro: Number(r.dinheiro)||0, pixDeposito: Number(r.pix_deposito)||0,
      cartaoAssinatura: Number(r.cartao_assinatura)||0, cartaoDebito: Number(r.cartao_debito)||0,
      valor: Number(r.valor)||0, obs: r.obs??'', apostilas: r.apostilas??'Não', qtdApostilas: Number(r.qtd_apostilas)||0,
    })));
    setLoadingMens(false);
  };

  const loadDocuments = async () => {
    const { data } = await supabase.from('student_documents').select('*').eq('auth_user_id', studentAuthId!).order('uploaded_at');
    if (data) setDocuments(data as DocItem[]);
  };

  const saveProfile = async () => {
    if (!profile.nome_completo.trim()) {
      toast.error('Preencha o Nome Completo antes de salvar.');
      return;
    }
    setSaving(true);

    let currentAlunoId = activeAlunoId;

    // 1. Create aluno if not exists yet
    if (!currentAlunoId) {
      const { data: newAluno } = await supabase.from('alunos').insert({
        nome: profile.nome_completo.trim(),
        ativo: true, tipo_bolsa: '',
        email: profile.email_contato || '',
        telefone: profile.telefone || profile.celular1 || '',
      }).select().maybeSingle();
      if (newAluno) {
        currentAlunoId = newAluno.id;
        setLocalAlunoId(newAluno.id);
      }
    } else {
      // Update existing aluno with latest profile data
      await supabase.from('alunos').update({
        nome: profile.nome_completo,
        telefone: profile.telefone || profile.celular1 || '',
        email: profile.email_contato || '',
      }).eq('id', currentAlunoId);
    }

    // 2. Generate matricula if aluno doesn't have one
    if (currentAlunoId && !alunoMatricula) {
      const matricula = await generateMatricula(new Date().getFullYear());
      await supabase.from('alunos').update({ matricula }).eq('id', currentAlunoId);
      setAlunoMatricula(matricula);
      toast.success(`Matrícula gerada: ${matricula}`);
    }

    // 3. Save to student_profiles
    const payload = { ...profile, auth_user_id: studentAuthId, aluno_id: currentAlunoId, updated_at: new Date().toISOString() };
    if (profileId) {
      const { error } = await supabase.from('student_profiles').update(payload).eq('id', profileId);
      if (error) { toast.error('Erro ao salvar ficha'); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('student_profiles').insert(payload).select().maybeSingle();
      if (error) { toast.error('Erro ao salvar ficha'); setSaving(false); return; }
      if (data) setProfileId(data.id);
    }

    toast.success('Ficha salva com sucesso!');
    setSaving(false);
  };

  const handleUpload = async (tipo: string, file: File) => {
    if (!studentAuthId) return;
    setUploading(p => ({ ...p, [tipo]: true }));
    const ext = file.name.split('.').pop();
    const path = `${studentAuthId}/${tipo}.${ext}`;

    const { error: upErr } = await supabase.storage.from('student-docs').upload(path, file, { upsert: true });
    if (upErr) { toast.error('Erro no upload: ' + upErr.message); setUploading(p => ({ ...p, [tipo]: false })); return; }

    const { data: urlData } = supabase.storage.from('student-docs').getPublicUrl(path);

    // Upsert document record
    const existing = documents.find(d => d.tipo === tipo);
    if (existing) {
      await supabase.from('student_documents').update({ nome_arquivo: file.name, url: urlData.publicUrl, storage_path: path, uploaded_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('student_documents').insert({ auth_user_id: studentAuthId, aluno_id: activeAlunoId, tipo, nome_arquivo: file.name, url: urlData.publicUrl, storage_path: path });
    }
    toast.success('Documento enviado!');
    await loadDocuments();
    setUploading(p => ({ ...p, [tipo]: false }));
  };

  const deleteDoc = async (doc: DocItem) => {
    await supabase.storage.from('student-docs').remove([doc.storage_path]);
    await supabase.from('student_documents').delete().eq('id', doc.id);
    toast.success('Documento removido');
    loadDocuments();
  };

  const fmt = (v: number) => v > 0 ? `R$ ${v.toFixed(2).replace('.', ',')}` : '—';
  const totalPago = mensalidades.reduce((s, m) => s + m.valor, 0);

  const field = (label: string, key: keyof ProfileForm, type = 'text', placeholder = '') => (
    <div>
      <label className="form-label text-xs">{label}</label>
      <Input type={type} className="form-input h-9 text-sm" placeholder={placeholder || label}
        value={profile[key] as string} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} />
    </div>
  );

  const TABS = [
    { id: 'ficha' as Tab, label: 'Minha Ficha', icon: FileText },
    { id: 'financeiro' as Tab, label: 'Financeiro', icon: CreditCard },
    { id: 'documentos' as Tab, label: 'Documentos', icon: Upload },
  ];

  return (
    <div className="min-h-screen bg-app-bg flex flex-col">
      {/* Header */}
      <header className="app-header sticky top-0 z-40 h-16 flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <img src="/logo-esteadeb.png" alt="ESTEADEB" className="h-8 w-auto object-contain" />
          <div className="hidden sm:block h-6 w-px bg-white/20" />
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-white font-semibold text-sm">ESTEADEB NÚCLEO {nucleoNome.toUpperCase()}</span>
            <span className="text-white/50 text-xs">Portal do Aluno</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-white/60 text-sm">
            <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
              <span className="text-xs font-bold text-white">{(studentName || 'A').charAt(0)}</span>
            </div>
            <span className="text-xs max-w-[140px] truncate">{studentName || 'Aluno'}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="text-white/70 hover:text-white hover:bg-white/10 gap-1.5 h-8 text-xs">
            <LogOut className="w-3.5 h-3.5" /><span className="hidden sm:block">Sair</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar */}
        <aside className="lg:w-56 app-sidebar">
          <nav className="flex lg:flex-col gap-1 p-3 overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`sidebar-nav-item flex-shrink-0 ${isActive ? 'active' : ''}`}>
                  <div className={`sidebar-nav-icon ${isActive ? 'active' : ''}`}><Icon className="w-4 h-4" /></div>
                  <span className="text-sm font-medium">{tab.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 opacity-60 ml-auto hidden lg:block" />}
                </button>
              );
            })}
          </nav>
          {/* Welcome card */}
          <div className="hidden lg:block px-4 pt-4 border-t border-sidebar-border mt-auto">
            <div className="text-xs text-sidebar-muted space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">{(studentName || 'A').charAt(0)}</span>
                </div>
                <div>
                  <p className="text-sidebar-text font-medium text-xs leading-tight max-w-[120px] truncate">{studentName || 'Aluno'}</p>
                  {alunoMatricula
                    ? <p className="text-xs font-mono" style={{ color: 'hsl(var(--primary))' }}>Mat: {alunoMatricula}</p>
                    : <p className="text-sidebar-muted text-xs">Portal do Aluno</p>}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {/* ── FICHA DE MATRÍCULA ──────────────────────────────── */}
          {activeTab === 'ficha' && (
            <div className="px-4 lg:px-8 py-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                    <GraduationCap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-foreground">Ficha de Matrícula</h1>
                    <p className="text-sm text-muted-foreground">
                      {alunoMatricula
                        ? <span>Matrícula: <strong className="text-primary">{alunoMatricula}</strong></span>
                        : 'Preencha seus dados — a matrícula será gerada ao salvar'}
                    </p>
                  </div>
                </div>
                <Button onClick={saveProfile} disabled={saving} className="btn-primary gap-2 h-9">
                  {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Salvando...' : 'Salvar Ficha'}
                </Button>
              </div>

              {/* 1. Dados Pessoais */}
              <div className="content-card p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">1</span>
                  Dados Pessoais
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 lg:col-span-3">{field('Nome Completo', 'nome_completo')}</div>
                  <div>
                    <label className="form-label text-xs">Sexo</label>
                    <Select value={profile.sexo || 'none'} onValueChange={v => setProfile(p => ({ ...p, sexo: v === 'none' ? '' : v }))}>
                      <SelectTrigger className="form-input h-9"><SelectValue placeholder="Sexo" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">—</SelectItem><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Feminino</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="form-label text-xs">Estado Civil</label>
                    <Select value={profile.estado_civil || 'none'} onValueChange={v => setProfile(p => ({ ...p, estado_civil: v === 'none' ? '' : v }))}>
                      <SelectTrigger className="form-input h-9"><SelectValue placeholder="Estado Civil" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                        <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                        <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                        <SelectItem value="Viúvo(a)">Viúvo(a)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {field('Data de Nascimento', 'data_nascimento', 'date')}
                  {field('Cidade de Nascimento', 'cidade_nascimento')}
                  {field('UF Nascimento', 'uf_nascimento', 'text', 'RN')}
                  {field('RG', 'rg')}
                  {field('Órgão Expedidor', 'orgao_expedidor', 'text', 'SSP/RN')}
                  {field('CPF', 'cpf', 'text', '000.000.000-00')}
                  <div className="sm:col-span-2">{field('Endereço Completo', 'endereco', 'text', 'Rua, número, complemento')}</div>
                  {field('Bairro', 'bairro')}
                  {field('CEP', 'cep', 'text', '00000-000')}
                  {field('Cidade', 'cidade')}
                  {field('UF', 'uf', 'text', 'RN')}
                  {field('Telefone', 'telefone', 'tel', '(84) 00000-0000')}
                  {field('Celular 1', 'celular1', 'tel')}
                  {field('Celular 2', 'celular2', 'tel', 'Opcional')}
                  {field('E-mail de Contato', 'email_contato', 'email')}
                  <div className="sm:col-span-2">{field('Nome do Pai', 'nome_pai')}</div>
                  <div className="sm:col-span-2">{field('Nome da Mãe', 'nome_mae')}</div>
                  {field('Profissão', 'profissao')}
                </div>
              </div>

              {/* 2. Dados Eclesiásticos */}
              <div className="content-card p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">2</span>
                  Dados Eclesiásticos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {field('Data de Conversão', 'data_conversao', 'date')}
                  {field('Data do Batismo em Águas', 'data_batismo', 'date')}
                  <div className="sm:col-span-2">{field('Igreja da qual é Membro', 'igreja_membro')}</div>
                  {field('Congregação', 'congregacao')}
                  {field('Função que exerce na Igreja', 'funcao_igreja')}
                </div>
              </div>

              {/* 3. Dados do Curso */}
              <div className="content-card p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">3</span>
                  Dados do Curso / Escolaridade
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="form-label text-xs">Nível de Formação</label>
                    <Select value={profile.nivel_formacao || 'none'} onValueChange={v => setProfile(p => ({ ...p, nivel_formacao: v === 'none' ? '' : v }))}>
                      <SelectTrigger className="form-input h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="Pós-Graduação">Pós-Graduação</SelectItem>
                        <SelectItem value="Superior Completo">Nível Superior Completo</SelectItem>
                        <SelectItem value="Superior Incompleto">Nível Superior Incompleto</SelectItem>
                        <SelectItem value="Nível Médio">Nível Médio</SelectItem>
                        <SelectItem value="Fundamental">Fundamental</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="form-label text-xs">Carga Horária</label>
                    <Select value={profile.carga_horaria || 'none'} onValueChange={v => setProfile(p => ({ ...p, carga_horaria: v === 'none' ? '' : v }))}>
                      <SelectTrigger className="form-input h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="Bacharelado">Bacharelado</SelectItem>
                        <SelectItem value="Médio">Médio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {field('Instituição', 'instituicao')}
                  {field('Ano de Término', 'ano_termino', 'text', '2026')}
                </div>
              </div>

              {/* 4. Habilidades */}
              <div className="content-card p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">4</span>
                  Habilidades e Competências
                </h3>
                <textarea
                  className="form-input w-full h-28 text-sm resize-none"
                  placeholder="Descreva suas habilidades e competências..."
                  value={profile.habilidades}
                  onChange={e => setProfile(p => ({ ...p, habilidades: e.target.value }))}
                />
              </div>

              <div className="flex justify-end pb-4">
                <Button onClick={saveProfile} disabled={saving} className="btn-primary gap-2">
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? 'Salvando...' : 'Salvar Ficha de Matrícula'}
                </Button>
              </div>
            </div>
          )}

          {/* ── FINANCEIRO ──────────────────────────────────────── */}
          {activeTab === 'financeiro' && (
            <div className="px-4 lg:px-8 py-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Histórico Financeiro</h1>
                  <p className="text-sm text-muted-foreground">Acompanhe seus pagamentos (somente leitura)</p>
                </div>
              </div>

              {!activeAlunoId ? (
                <div className="content-card p-8 text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-amber-400 opacity-60" />
                  <p className="font-medium text-foreground">Cadastro ainda não vinculado</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Preencha e salve sua Ficha de Matrícula para gerar automaticamente seu número de matrícula e vincular ao sistema.
                  </p>
                </div>
              ) : loadingMens ? (
                <div className="flex justify-center py-12"><div className="loading-spinner" /></div>
              ) : mensalidades.length === 0 ? (
                <div className="empty-state">
                  <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum registro financeiro encontrado</p>
                </div>
              ) : (
                <>
                  {/* PIX Card */}
                  <div className="content-card p-5">
                    <div className="flex flex-col sm:flex-row gap-5 items-start">
                      {/* QR Code */}
                      <div className="flex flex-col items-center gap-2 flex-shrink-0">
                        <div className="p-3 bg-white rounded-2xl shadow-sm border border-border">
                          <QRCodeSVG value={PIX_PAYLOAD} size={140} level="M" />
                        </div>
                        <span className="text-xs text-muted-foreground">Escaneie para pagar</span>
                      </div>
                      {/* Info */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <QrCode className="w-5 h-5 text-primary" />
                          <h3 className="font-semibold text-foreground text-sm">Pagamento via PIX</h3>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Tipo de chave: <strong>CNPJ</strong></p>
                          <p className="text-xs text-muted-foreground">Favorecido: <strong>ESTEADEB NÚCLEO ZONA OESTE</strong></p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5">Chave PIX (CNPJ):</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2">
                              <code className="text-sm font-mono font-bold text-foreground tracking-wide">{PIX_KEY_DISPLAY}</code>
                            </div>
                            <Button size="sm" variant="outline" onClick={copyPix}
                              className={`gap-1.5 h-9 flex-shrink-0 transition-all ${pixCopied ? 'border-emerald-300 text-emerald-600 bg-emerald-50' : ''}`}>
                              {pixCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {pixCopied ? 'Copiado!' : 'Copiar'}
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          Após efetuar o pagamento, informe o comprovante ao coordenador para registro da mensalidade.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Summary cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="content-card p-4 bg-emerald-50 border-0">
                      <p className="text-xs text-muted-foreground">Total Pago</p>
                      <p className="text-xl font-bold text-emerald-600">R$ {totalPago.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div className="content-card p-4 bg-primary/5 border-0">
                      <p className="text-xs text-muted-foreground">Meses Pagos</p>
                      <p className="text-xl font-bold text-primary">{mensalidades.filter(m => m.situacao === 'Pago').length}</p>
                    </div>
                    <div className="content-card p-4 bg-red-50 border-0">
                      <p className="text-xs text-muted-foreground">Pendentes</p>
                      <p className="text-xl font-bold text-red-600">{mensalidades.filter(m => m.situacao !== 'Pago').length}</p>
                    </div>
                  </div>

                  <div className="content-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="table-head">
                            <th className="table-th text-left">Mês</th>
                            <th className="table-th text-right hidden sm:table-cell">Dinheiro</th>
                            <th className="table-th text-right hidden sm:table-cell">Pix/Dep.</th>
                            <th className="table-th text-right hidden md:table-cell">Cart.Ass.</th>
                            <th className="table-th text-right hidden md:table-cell">Cart.Déb.</th>
                            <th className="table-th text-right">Total</th>
                            <th className="table-th text-center">Situação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {mensalidades.map(m => (
                            <tr key={m.id} className="table-row">
                              <td className="table-td font-medium text-foreground">{mesLabel(m.mes)}</td>
                              <td className="table-td text-right text-sm text-muted-foreground hidden sm:table-cell">{fmt(m.dinheiro)}</td>
                              <td className="table-td text-right text-sm text-muted-foreground hidden sm:table-cell">{fmt(m.pixDeposito)}</td>
                              <td className="table-td text-right text-sm text-muted-foreground hidden md:table-cell">{fmt(m.cartaoAssinatura)}</td>
                              <td className="table-td text-right text-sm text-muted-foreground hidden md:table-cell">{fmt(m.cartaoDebito)}</td>
                              <td className="table-td text-right font-bold text-emerald-600">{fmt(m.valor)}</td>
                              <td className="table-td text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold gap-1 ${m.situacao === 'Pago' ? 'badge-pago' : 'badge-pendente'}`}>
                                  {m.situacao === 'Pago' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                  {m.situacao}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/30">
                            <td colSpan={5} className="table-td font-bold text-foreground">Total Geral</td>
                            <td className="table-td text-right font-bold text-emerald-600">R$ {totalPago.toFixed(2).replace('.', ',')}</td>
                            <td className="table-td" />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── DOCUMENTOS ──────────────────────────────────────── */}
          {activeTab === 'documentos' && (
            <div className="px-4 lg:px-8 py-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Documentos</h1>
                  <p className="text-sm text-muted-foreground">Envie os documentos solicitados para sua matrícula</p>
                </div>
              </div>

              <div className="content-card p-4 bg-blue-50 border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Formatos aceitos:</strong> JPG, PNG, PDF, BMP, TIFF e outros formatos de imagem. Tamanho máximo: 50MB por arquivo.
                </p>
              </div>

              <div className="grid gap-4">
                {DOCUMENTOS.map(doc => {
                  const uploaded = documents.find(d => d.tipo === doc.tipo);
                  const isUploading = uploading[doc.tipo];
                  return (
                    <div key={doc.tipo} className="content-card p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${uploaded ? 'bg-emerald-100' : 'bg-muted'}`}>
                            {uploaded ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <FileText className="w-5 h-5 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-foreground">{doc.label}</p>
                            {uploaded ? (
                              <p className="text-xs text-emerald-600 truncate">{uploaded.nome_arquivo} · {new Date(uploaded.uploaded_at).toLocaleDateString('pt-BR')}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">Nenhum arquivo enviado</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {uploaded && (
                            <>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                                onClick={() => window.open(uploaded.url, '_blank')} title="Visualizar">
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                onClick={() => deleteDoc(uploaded)} title="Remover">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          <input
                            type="file" accept={doc.accept}
                            className="hidden"
                            ref={el => { fileInputRefs.current[doc.tipo] = el; }}
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(doc.tipo, file);
                              e.target.value = '';
                            }}
                          />
                          <Button
                            variant={uploaded ? 'outline' : 'default'}
                            size="sm"
                            className={`gap-1.5 h-8 text-xs ${!uploaded ? 'btn-primary' : ''}`}
                            disabled={isUploading}
                            onClick={() => fileInputRefs.current[doc.tipo]?.click()}
                          >
                            {isUploading ? (
                              <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            {isUploading ? 'Enviando...' : uploaded ? 'Substituir' : 'Enviar'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="content-card p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm font-semibold text-foreground">Progresso: {documents.length}/{DOCUMENTOS.length} documentos enviados</p>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${(documents.length / DOCUMENTOS.length) * 100}%` }} />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default StudentPortal;
