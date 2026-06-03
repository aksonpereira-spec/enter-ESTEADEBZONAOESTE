import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User, BookOpen, FileText, LogOut, Upload, Trash2, Save,
  GraduationCap, ChevronRight, Hash, Building2, Phone,
  MapPin, Heart, Download, AlertCircle
} from 'lucide-react';

const SESSION_KEY = 'portal_aluno_session';

interface AlunoSession {
  alunoId: string;
  nome: string;
  matricula: string;
  turmaId: string | null;
  turmaNome: string;
}

interface ProfileData {
  nome_completo: string;
  cpf: string;
  rg: string;
  orgao_expedidor: string;
  data_nascimento: string;
  cidade_nascimento: string;
  uf_nascimento: string;
  sexo: string;
  estado_civil: string;
  profissao: string;
  email_contato: string;
  celular1: string;
  celular2: string;
  telefone: string;
  email: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  congregacao: string;
  igreja_membro: string;
  funcao_igreja: string;
  data_conversao: string;
  data_batismo: string;
  nome_pai: string;
  nome_mae: string;
  nivel_formacao: string;
  instituicao: string;
  habilidades: string;
}

interface Nota {
  id: string;
  disciplina_nome: string;
  disciplina_numero: number;
  nota: number | null;
  periodo: string;
}

interface Arquivo {
  id: string;
  nome_arquivo: string;
  url: string;
  storage_path: string;
  uploaded_at: string;
}

const emptyProfile: ProfileData = {
  nome_completo: '', cpf: '', rg: '', orgao_expedidor: '', data_nascimento: '',
  cidade_nascimento: '', uf_nascimento: '', sexo: '', estado_civil: '', profissao: '',
  email_contato: '', celular1: '', celular2: '', telefone: '', email: '',
  endereco: '', bairro: '', cidade: '', uf: '', cep: '',
  congregacao: '', igreja_membro: '', funcao_igreja: '', data_conversao: '',
  data_batismo: '', nome_pai: '', nome_mae: '', nivel_formacao: '', instituicao: '', habilidades: '',
};

const getSituacao = (nota: number | null) => {
  if (nota === null || nota === undefined) return { label: 'Cursando', cls: 'badge-neutro' };
  if (nota >= 7) return { label: 'Aprovado', cls: 'badge-pago' };
  if (nota >= 5) return { label: 'Exame', cls: 'text-amber-700 bg-amber-100 border border-amber-200' };
  return { label: 'Reprovado', cls: 'badge-inadimplente' };
};

export default function PortalAluno() {
  const [session, setSession] = useState<AlunoSession | null>(null);
  const [matriculaInput, setMatriculaInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ficha');

  // Ficha
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [alunoEmail, setAlunoEmail] = useState('');
  const [alunoTelefone, setAlunoTelefone] = useState('');

  // Notas
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loadingNotas, setLoadingNotas] = useState(false);

  // Documentos
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try { setSession(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const loadProfile = useCallback(async (alunoId: string) => {
    // Load aluno base data
    const { data: aluno } = await supabase
      .from('alunos').select('email, telefone').eq('id', alunoId).maybeSingle();
    if (aluno) {
      setAlunoEmail(aluno.email || '');
      setAlunoTelefone(aluno.telefone || '');
    }

    // Load student profile
    const { data } = await supabase
      .from('student_profiles').select('*').eq('aluno_id', alunoId).maybeSingle();
    if (data) {
      setProfileId(data.id);
      setProfile({
        nome_completo: data.nome_completo || '',
        cpf: data.cpf || '', rg: data.rg || '', orgao_expedidor: data.orgao_expedidor || '',
        data_nascimento: data.data_nascimento || '', cidade_nascimento: data.cidade_nascimento || '',
        uf_nascimento: data.uf_nascimento || '', sexo: data.sexo || '', estado_civil: data.estado_civil || '',
        profissao: data.profissao || '', email_contato: data.email_contato || '',
        celular1: data.celular1 || '', celular2: data.celular2 || '',
        telefone: data.telefone || '', email: data.email_contato || '',
        endereco: data.endereco || '', bairro: data.bairro || '', cidade: data.cidade || '',
        uf: data.uf || '', cep: data.cep || '', congregacao: data.congregacao || '',
        igreja_membro: data.igreja_membro || '', funcao_igreja: data.funcao_igreja || '',
        data_conversao: data.data_conversao || '', data_batismo: data.data_batismo || '',
        nome_pai: data.nome_pai || '', nome_mae: data.nome_mae || '',
        nivel_formacao: data.nivel_formacao || '', instituicao: data.instituicao || '',
        habilidades: data.habilidades || '',
      });
    } else {
      setProfileId(null);
      setProfile({ ...emptyProfile, nome_completo: '' });
    }
  }, []);

  const loadNotas = useCallback(async (alunoId: string) => {
    setLoadingNotas(true);
    const { data } = await supabase
      .from('notas_aluno').select('*').eq('aluno_id', alunoId)
      .order('disciplina_numero', { ascending: true });
    setNotas(data || []);
    setLoadingNotas(false);
  }, []);

  const loadArquivos = useCallback(async (alunoId: string) => {
    const { data } = await supabase
      .from('portal_arquivos').select('*').eq('aluno_id', alunoId)
      .order('uploaded_at', { ascending: false });
    setArquivos(data || []);
  }, []);

  useEffect(() => {
    if (session) {
      loadProfile(session.alunoId);
      loadNotas(session.alunoId);
      loadArquivos(session.alunoId);
    }
  }, [session, loadProfile, loadNotas, loadArquivos]);

  const handleLogin = async () => {
    if (!matriculaInput.trim()) {
      toast.error('Digite sua matrícula');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('alunos')
        .select('id, nome, matricula, turma_id, ativo, portal_bloqueado')
        .eq('matricula', matriculaInput.trim())
        .neq('matricula', '')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error('Matrícula não encontrada. Verifique o número e tente novamente.');
        return;
      }
      if (!data.ativo) {
        toast.error('Aluno inativo. Contacte a secretaria.');
        return;
      }
      if (data.portal_bloqueado) {
        toast.error('Acesso bloqueado. Contacte a secretaria.');
        return;
      }

      let turmaNome = '';
      if (data.turma_id) {
        const { data: turma } = await supabase
          .from('classes').select('nome').eq('id', data.turma_id).maybeSingle();
        turmaNome = turma?.nome || '';
      }

      const newSession: AlunoSession = {
        alunoId: data.id,
        nome: data.nome,
        matricula: data.matricula || '',
        turmaId: data.turma_id,
        turmaNome,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      setSession(newSession);
      toast.success(`Bem-vindo, ${data.nome}!`);
    } catch {
      toast.error('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setProfile(emptyProfile);
    setProfileId(null);
    setNotas([]);
    setArquivos([]);
    setMatriculaInput('');
  };

  const handleSaveProfile = async () => {
    if (!session) return;
    setSavingProfile(true);
    try {
      // Update aluno base info
      await supabase.from('alunos').update({
        email: alunoEmail,
        telefone: alunoTelefone,
      }).eq('id', session.alunoId);

      // Upsert student profile
      const payload = {
        aluno_id: session.alunoId,
        nome_completo: profile.nome_completo,
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
        habilidades: profile.habilidades,
        updated_at: new Date().toISOString(),
      };

      if (profileId) {
        const { error } = await supabase.from('student_profiles')
          .update(payload).eq('id', profileId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('student_profiles').insert(payload).select().single();
        if (error) throw error;
        setProfileId(data.id);
      }
      toast.success('Informações salvas com sucesso!');
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande (máx 20 MB)');
      return;
    }

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${session.alunoId}/${Date.now()}_${safeName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('portal-docs')
        .upload(storagePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('portal-docs')
        .getPublicUrl(uploadData.path);

      const { error: dbError } = await supabase.from('portal_arquivos').insert({
        aluno_id: session.alunoId,
        nome_arquivo: file.name,
        url: publicUrl,
        storage_path: uploadData.path,
      });
      if (dbError) throw dbError;

      toast.success('Arquivo enviado com sucesso!');
      loadArquivos(session.alunoId);
    } catch {
      toast.error('Erro ao enviar arquivo. Tente novamente.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDeleteArquivo = async (arq: Arquivo) => {
    if (!session) return;
    try {
      if (arq.storage_path) {
        await supabase.storage.from('portal-docs').remove([arq.storage_path]);
      }
      await supabase.from('portal_arquivos').delete().eq('id', arq.id);
      toast.success('Arquivo removido');
      loadArquivos(session.alunoId);
    } catch {
      toast.error('Erro ao remover arquivo');
    }
  };

  const setP = (k: keyof ProfileData, v: string) => setProfile(p => ({ ...p, [k]: v }));

  // ─── LOGIN SCREEN ────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted)/0.3) 100%)' }}>
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
              <GraduationCap className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Portal do Aluno</h1>
            <p className="text-muted-foreground text-sm mt-1">ESTEADEB — Escola Teológica</p>
          </div>

          {/* Card */}
          <div className="content-card p-6 shadow-lg">
            <div className="space-y-4">
              <div>
                <Label className="form-label">Número de Matrícula</Label>
                <Input
                  className="form-input mt-1 text-center text-lg font-mono tracking-widest"
                  placeholder="Ex: 2026001"
                  value={matriculaInput}
                  onChange={e => setMatriculaInput(e.target.value.trim())}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  name="matricula-portal"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  Digite apenas o número da matrícula (ex: 2026001)
                </p>
              </div>
              <Button
                onClick={handleLogin}
                disabled={loading || !matriculaInput.trim()}
                className="w-full btn-primary gap-2 h-10">
                {loading ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : <ChevronRight className="w-4 h-4" />}
                {loading ? 'Verificando...' : 'Acessar Portal'}
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-4">
              Não possui matrícula? Contacte a secretaria.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── PORTAL PRINCIPAL ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">{session.nome.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm leading-tight">{session.nome}</p>
              <p className="text-xs text-muted-foreground font-mono">{session.matricula}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {session.turmaNome && (
              <span className="hidden sm:inline text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                {session.turmaNome}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-muted-foreground hover:text-destructive h-8">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-6 grid grid-cols-3">
            <TabsTrigger value="ficha" className="gap-1.5 text-xs sm:text-sm">
              <User className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Minha Ficha</span>
              <span className="xs:hidden">Ficha</span>
            </TabsTrigger>
            <TabsTrigger value="notas" className="gap-1.5 text-xs sm:text-sm">
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Minhas Notas</span>
              <span className="xs:hidden">Notas</span>
            </TabsTrigger>
            <TabsTrigger value="documentos" className="gap-1.5 text-xs sm:text-sm">
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Documentos</span>
              <span className="xs:hidden">Docs</span>
            </TabsTrigger>
          </TabsList>

          {/* ── TAB FICHA ── */}
          <TabsContent value="ficha">
            <div className="space-y-5">
              {/* Dados da Escola (readonly) */}
              <div className="content-card p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-primary" />Dados Escolares
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="form-label">Matrícula</p>
                    <p className="font-mono font-semibold text-foreground mt-1">{session.matricula || '—'}</p>
                  </div>
                  <div>
                    <p className="form-label">Turma</p>
                    <p className="font-medium text-foreground mt-1">{session.turmaNome || '—'}</p>
                  </div>
                  <div>
                    <p className="form-label">Nome</p>
                    <p className="font-medium text-foreground mt-1">{session.nome}</p>
                  </div>
                </div>
              </div>

              {/* Dados Pessoais */}
              <div className="content-card p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />Dados Pessoais
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label className="form-label">Nome Completo</Label>
                    <Input className="form-input mt-1" value={profile.nome_completo}
                      onChange={e => setP('nome_completo', e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div>
                    <Label className="form-label">CPF</Label>
                    <Input className="form-input mt-1" value={profile.cpf}
                      onChange={e => setP('cpf', e.target.value)} placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <Label className="form-label">RG</Label>
                    <Input className="form-input mt-1" value={profile.rg}
                      onChange={e => setP('rg', e.target.value)} placeholder="Número do RG" />
                  </div>
                  <div>
                    <Label className="form-label">Órgão Expedidor</Label>
                    <Input className="form-input mt-1" value={profile.orgao_expedidor}
                      onChange={e => setP('orgao_expedidor', e.target.value)} placeholder="SSP/XX" />
                  </div>
                  <div>
                    <Label className="form-label">Data de Nascimento</Label>
                    <Input className="form-input mt-1" type="date" value={profile.data_nascimento}
                      onChange={e => setP('data_nascimento', e.target.value)} />
                  </div>
                  <div>
                    <Label className="form-label">Cidade de Nascimento</Label>
                    <Input className="form-input mt-1" value={profile.cidade_nascimento}
                      onChange={e => setP('cidade_nascimento', e.target.value)} placeholder="Cidade" />
                  </div>
                  <div>
                    <Label className="form-label">UF Nascimento</Label>
                    <Input className="form-input mt-1" value={profile.uf_nascimento}
                      onChange={e => setP('uf_nascimento', e.target.value)} placeholder="XX" maxLength={2} />
                  </div>
                  <div>
                    <Label className="form-label">Sexo</Label>
                    <Select value={profile.sexo || 'none'} onValueChange={v => setP('sexo', v === 'none' ? '' : v)}>
                      <SelectTrigger className="form-input mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="Masculino">Masculino</SelectItem>
                        <SelectItem value="Feminino">Feminino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="form-label">Estado Civil</Label>
                    <Select value={profile.estado_civil || 'none'} onValueChange={v => setP('estado_civil', v === 'none' ? '' : v)}>
                      <SelectTrigger className="form-input mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                        <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                        <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                        <SelectItem value="Viúvo(a)">Viúvo(a)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="form-label">Profissão</Label>
                    <Input className="form-input mt-1" value={profile.profissao}
                      onChange={e => setP('profissao', e.target.value)} placeholder="Profissão" />
                  </div>
                </div>
              </div>

              {/* Contato */}
              <div className="content-card p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />Contato
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className="form-label">Celular Principal</Label>
                    <Input className="form-input mt-1" value={profile.celular1}
                      onChange={e => setP('celular1', e.target.value)} placeholder="(00) 00000-0000" />
                  </div>
                  <div>
                    <Label className="form-label">Celular Secundário</Label>
                    <Input className="form-input mt-1" value={profile.celular2}
                      onChange={e => setP('celular2', e.target.value)} placeholder="(00) 00000-0000" />
                  </div>
                  <div>
                    <Label className="form-label">E-mail</Label>
                    <Input className="form-input mt-1" type="email" value={alunoEmail}
                      onChange={e => setAlunoEmail(e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                  <div>
                    <Label className="form-label">E-mail de Contato Alternativo</Label>
                    <Input className="form-input mt-1" type="email" value={profile.email_contato}
                      onChange={e => setP('email_contato', e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="content-card p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />Endereço
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <Label className="form-label">Endereço</Label>
                    <Input className="form-input mt-1" value={profile.endereco}
                      onChange={e => setP('endereco', e.target.value)} placeholder="Rua, número, complemento" />
                  </div>
                  <div>
                    <Label className="form-label">CEP</Label>
                    <Input className="form-input mt-1" value={profile.cep}
                      onChange={e => setP('cep', e.target.value)} placeholder="00000-000" />
                  </div>
                  <div>
                    <Label className="form-label">Bairro</Label>
                    <Input className="form-input mt-1" value={profile.bairro}
                      onChange={e => setP('bairro', e.target.value)} placeholder="Bairro" />
                  </div>
                  <div>
                    <Label className="form-label">Cidade</Label>
                    <Input className="form-input mt-1" value={profile.cidade}
                      onChange={e => setP('cidade', e.target.value)} placeholder="Cidade" />
                  </div>
                  <div>
                    <Label className="form-label">UF</Label>
                    <Input className="form-input mt-1" value={profile.uf}
                      onChange={e => setP('uf', e.target.value)} placeholder="XX" maxLength={2} />
                  </div>
                </div>
              </div>

              {/* Igreja */}
              <div className="content-card p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />Igreja
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className="form-label">Congregação</Label>
                    <Input className="form-input mt-1" value={profile.congregacao}
                      onChange={e => setP('congregacao', e.target.value)} placeholder="Nome da congregação" />
                  </div>
                  <div>
                    <Label className="form-label">Igreja Membro</Label>
                    <Input className="form-input mt-1" value={profile.igreja_membro}
                      onChange={e => setP('igreja_membro', e.target.value)} placeholder="Igreja" />
                  </div>
                  <div>
                    <Label className="form-label">Função na Igreja</Label>
                    <Input className="form-input mt-1" value={profile.funcao_igreja}
                      onChange={e => setP('funcao_igreja', e.target.value)} placeholder="Pastor, Diácono..." />
                  </div>
                  <div>
                    <Label className="form-label">Data de Conversão</Label>
                    <Input className="form-input mt-1" type="date" value={profile.data_conversao}
                      onChange={e => setP('data_conversao', e.target.value)} />
                  </div>
                  <div>
                    <Label className="form-label">Data de Batismo</Label>
                    <Input className="form-input mt-1" type="date" value={profile.data_batismo}
                      onChange={e => setP('data_batismo', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Família */}
              <div className="content-card p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-primary" />Família e Formação
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className="form-label">Nome do Pai</Label>
                    <Input className="form-input mt-1" value={profile.nome_pai}
                      onChange={e => setP('nome_pai', e.target.value)} placeholder="Nome do pai" />
                  </div>
                  <div>
                    <Label className="form-label">Nome da Mãe</Label>
                    <Input className="form-input mt-1" value={profile.nome_mae}
                      onChange={e => setP('nome_mae', e.target.value)} placeholder="Nome da mãe" />
                  </div>
                  <div>
                    <Label className="form-label">Nível de Formação</Label>
                    <Select value={profile.nivel_formacao || 'none'} onValueChange={v => setP('nivel_formacao', v === 'none' ? '' : v)}>
                      <SelectTrigger className="form-input mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="Fundamental">Fundamental</SelectItem>
                        <SelectItem value="Médio">Médio</SelectItem>
                        <SelectItem value="Superior">Superior</SelectItem>
                        <SelectItem value="Pós-graduação">Pós-graduação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="form-label">Instituição de Ensino</Label>
                    <Input className="form-input mt-1" value={profile.instituicao}
                      onChange={e => setP('instituicao', e.target.value)} placeholder="Escola/Faculdade" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="form-label">Habilidades / Talentos</Label>
                    <Input className="form-input mt-1" value={profile.habilidades}
                      onChange={e => setP('habilidades', e.target.value)} placeholder="Ex: Música, Liderança..." />
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={savingProfile} className="btn-primary gap-2 h-10 px-6">
                  {savingProfile
                    ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    : <Save className="w-4 h-4" />}
                  {savingProfile ? 'Salvando...' : 'Salvar Informações'}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── TAB NOTAS ── */}
          <TabsContent value="notas">
            <div className="content-card overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-primary" />Situação Escolar
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Aluno: <strong>{session.nome}</strong> — Matrícula: <strong className="font-mono">{session.matricula}</strong>
                    </p>
                  </div>
                  {session.turmaNome && (
                    <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                      {session.turmaNome}
                    </span>
                  )}
                </div>
              </div>

              {loadingNotas ? (
                <div className="flex justify-center py-12">
                  <div className="loading-spinner" />
                </div>
              ) : notas.length === 0 ? (
                <div className="empty-state py-16">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhuma nota lançada ainda</p>
                  <p className="text-sm mt-1">As notas serão disponibilizadas pela secretaria</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="table-head">
                        <th className="table-th text-center w-12">Nr</th>
                        <th className="table-th text-left">Disciplina</th>
                        <th className="table-th text-center hidden sm:table-cell">Período</th>
                        <th className="table-th text-center w-20">Média</th>
                        <th className="table-th text-center">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {notas.map(n => {
                        const sit = getSituacao(n.nota);
                        return (
                          <tr key={n.id} className="table-row">
                            <td className="table-td text-center">
                              <span className="text-muted-foreground text-sm font-mono">{n.disciplina_numero}</span>
                            </td>
                            <td className="table-td">
                              <span className="font-medium text-foreground text-sm">{n.disciplina_nome}</span>
                            </td>
                            <td className="table-td text-center hidden sm:table-cell">
                              <span className="text-muted-foreground text-xs">{n.periodo || '—'}</span>
                            </td>
                            <td className="table-td text-center">
                              {n.nota !== null ? (
                                <span className={`font-bold text-base ${
                                  n.nota >= 7 ? 'text-emerald-600' :
                                  n.nota >= 5 ? 'text-amber-600' : 'text-red-600'
                                }`}>{Number(n.nota).toFixed(1)}</span>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </td>
                            <td className="table-td text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${sit.cls}`}>
                                {sit.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {notas.length > 0 && (
                <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{notas.length} disciplina{notas.length !== 1 ? 's' : ''}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Aprovado ≥ 7,0
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Exame ≥ 5,0
                    </span>
                    <span className="flex items-center gap-1 hidden sm:flex">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Reprovado &lt; 5,0
                    </span>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── TAB DOCUMENTOS ── */}
          <TabsContent value="documentos">
            <div className="space-y-4">
              {/* Upload area */}
              <div className="content-card p-5">
                <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" />Enviar Documento
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Certificados, comprovantes, declarações e outros documentos pessoais (máx 20 MB)
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  onChange={handleUploadFile}
                  className="hidden"
                  id="file-upload"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                />
                <label
                  htmlFor="file-upload"
                  className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-xl cursor-pointer
                    hover:border-primary/40 hover:bg-primary/5 transition-all
                    ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <span className="text-sm text-muted-foreground">Enviando...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Clique para selecionar arquivo</span>
                      <span className="text-xs text-muted-foreground">PDF, DOC, JPG, PNG</span>
                    </div>
                  )}
                </label>
              </div>

              {/* File list */}
              <div className="content-card overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />Meus Documentos
                    {arquivos.length > 0 && (
                      <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                        {arquivos.length}
                      </span>
                    )}
                  </h3>
                </div>

                {arquivos.length === 0 ? (
                  <div className="empty-state py-12">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Nenhum documento enviado</p>
                    <p className="text-sm mt-1">Use o campo acima para enviar seus documentos</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {arquivos.map(arq => (
                      <div key={arq.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{arq.nome_arquivo}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(arq.uploaded_at).toLocaleDateString('pt-BR', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                          <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary">
                            <a href={arq.url} target="_blank" rel="noopener noreferrer">
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteArquivo(arq)}
                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
