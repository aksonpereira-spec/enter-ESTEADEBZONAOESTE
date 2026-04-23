import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, FileText, Eye, Link2, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, Mail, Phone, MapPin, BookOpen, Upload, RefreshCw,
  Trash2, ShieldOff, ShieldCheck, MessageCircle, AlertTriangle, DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';

interface StudentProfile {
  id: string;
  auth_user_id: string;
  aluno_id: string | null;
  nome_completo: string;
  email_contato: string;
  sexo: string;
  estado_civil: string;
  data_nascimento: string;
  cidade_nascimento: string;
  uf_nascimento: string;
  rg: string;
  cpf: string;
  endereco: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  telefone: string;
  celular1: string;
  celular2: string;
  nome_pai: string;
  nome_mae: string;
  profissao: string;
  data_conversao: string;
  data_batismo: string;
  igreja_membro: string;
  congregacao: string;
  funcao_igreja: string;
  nivel_formacao: string;
  carga_horaria: string;
  instituicao: string;
  ano_termino: string;
  habilidades: string;
  created_at: string;
  // merged from alunos
  aluno_nome: string;
  aluno_matricula: string;
  aluno_inadimplente: boolean;
  aluno_portal_bloqueado: boolean;
  aluno_telefone: string;
  aluno_celular1: string;
}

interface AlunoData {
  id: string;
  nome: string;
  matricula: string | null;
  inadimplente: boolean | null;
  portal_bloqueado: boolean | null;
  telefone: string | null;
  celular1: string | null;
}

interface DocItem { tipo: string; nome_arquivo: string; url: string; uploaded_at: string; }
interface Aluno { id: string; nome: string; matricula: string; }

const PIX_KEY_DISPLAY = '40.800.393/0001-32';
const COORDINATOR_PHONE_DISPLAY = '(84) 99848-1937';

function buildWhatsAppLink(rawPhone: string, studentName: string): string {
  const phone = '55' + rawPhone.replace(/\D/g, '');
  const lines = [
    'Ola ' + (studentName || 'aluno(a)') + '! Tudo bem?',
    '',
    'Identificamos uma pendencia na sua mensalidade na *ESTEADEB Nucleo Zona Oeste*.',
    '',
    'Voce pode regularizar via *PIX*:',
    'Chave CNPJ: *' + PIX_KEY_DISPLAY + '*',
    '',
    'Outras opcoes - coordenador: *' + COORDINATOR_PHONE_DISPLAY + '*',
    '',
    'Apos pagar, envie o comprovante. Deus abencoe!',
  ];
  return 'https://wa.me/' + phone + '?text=' + lines.map(l => encodeURIComponent(l)).join('%0A');
}

const FichasTab = () => {
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, DocItem[]>>({});
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [selectedAluno, setSelectedAluno] = useState<Record<string, string>>({});
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => { loadProfiles(); loadAlunos(); }, []);

  const loadProfiles = async () => {
    setLoading(true);
    setLoadError('');

    // Step 1: fetch all student_profiles
    const { data: profileData, error: profileError } = await supabase
      .from('student_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profileError) {
      setLoadError(profileError.message);
      toast.error('Erro ao carregar fichas: ' + profileError.message);
      setLoading(false);
      return;
    }

    // Step 2: fetch alunos for linked profiles
    const alunoIds = (profileData || [])
      .filter(p => p.aluno_id)
      .map(p => p.aluno_id as string);

    const alunosMap: Record<string, AlunoData> = {};
    if (alunoIds.length > 0) {
      const { data: alunosData } = await supabase
        .from('alunos')
        .select('id, nome, matricula, inadimplente, portal_bloqueado, telefone, celular1')
        .in('id', alunoIds);
      if (alunosData) {
        alunosData.forEach((a) => {
          alunosMap[a.id] = a as AlunoData;
        });
      }
    }

    // Step 3: merge
    const list: StudentProfile[] = (profileData || []).map(p => {
      const al = p.aluno_id ? alunosMap[p.aluno_id] : null;
      return {
        id: p.id ?? '',
        auth_user_id: p.auth_user_id ?? '',
        aluno_id: p.aluno_id ?? null,
        nome_completo: p.nome_completo ?? '',
        email_contato: p.email_contato ?? '',
        sexo: p.sexo ?? '',
        estado_civil: p.estado_civil ?? '',
        data_nascimento: p.data_nascimento ?? '',
        cidade_nascimento: p.cidade_nascimento ?? '',
        uf_nascimento: p.uf_nascimento ?? '',
        rg: p.rg ?? '',
        cpf: p.cpf ?? '',
        endereco: p.endereco ?? '',
        bairro: p.bairro ?? '',
        cep: p.cep ?? '',
        cidade: p.cidade ?? '',
        uf: p.uf ?? '',
        telefone: p.telefone ?? '',
        celular1: p.celular1 ?? '',
        celular2: p.celular2 ?? '',
        nome_pai: p.nome_pai ?? '',
        nome_mae: p.nome_mae ?? '',
        profissao: p.profissao ?? '',
        data_conversao: p.data_conversao ?? '',
        data_batismo: p.data_batismo ?? '',
        igreja_membro: p.igreja_membro ?? '',
        congregacao: p.congregacao ?? '',
        funcao_igreja: p.funcao_igreja ?? '',
        nivel_formacao: p.nivel_formacao ?? '',
        carga_horaria: p.carga_horaria ?? '',
        instituicao: p.instituicao ?? '',
        ano_termino: p.ano_termino ?? '',
        habilidades: p.habilidades ?? '',
        created_at: p.created_at ?? '',
        aluno_nome: al?.nome ?? '',
        aluno_matricula: al?.matricula ?? '',
        aluno_inadimplente: al?.inadimplente ?? false,
        aluno_portal_bloqueado: al?.portal_bloqueado ?? false,
        aluno_telefone: al?.telefone ?? '',
        aluno_celular1: al?.celular1 ?? '',
      };
    });

    setProfiles(list);
    setLoading(false);
  };

  const loadAlunos = async () => {
    const { data } = await supabase.from('alunos').select('id, nome, matricula').eq('ativo', true).order('nome');
    if (data) setAlunos(data as Aluno[]);
  };

  const loadDocs = async (authUserId: string) => {
    if (docs[authUserId]) return;
    const { data } = await supabase
      .from('student_documents')
      .select('tipo, nome_arquivo, url, uploaded_at')
      .eq('auth_user_id', authUserId)
      .order('uploaded_at');
    if (data) setDocs(prev => ({ ...prev, [authUserId]: data as DocItem[] }));
  };

  const toggleExpand = (id: string, authUserId: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    loadDocs(authUserId);
  };

  const syncProfileToAluno = async (profile: StudentProfile, alunoId: string) => {
    const update: Record<string, string> = {};
    if (profile.nome_completo) update.nome = profile.nome_completo;
    if (profile.telefone || profile.celular1) update.telefone = profile.telefone || profile.celular1;
    if (profile.email_contato) update.email = profile.email_contato;
    if (Object.keys(update).length > 0) {
      await supabase.from('alunos').update(update).eq('id', alunoId);
    }
  };

  const handleSync = async (profile: StudentProfile) => {
    if (!profile.aluno_id) return;
    setSyncingId(profile.id);
    await syncProfileToAluno(profile, profile.aluno_id);
    toast.success('Dados sincronizados!');
    setSyncingId(null);
    await loadProfiles();
  };

  const linkAluno = async (profileId: string, alunoId: string) => {
    if (!alunoId || alunoId === 'none') return;
    setLinkingId(profileId);
    const { error } = await supabase.from('student_profiles').update({ aluno_id: alunoId }).eq('id', profileId);
    if (error) {
      toast.error('Erro ao vincular: ' + error.message);
    } else {
      const profile = profiles.find(p => p.id === profileId);
      if (profile) await syncProfileToAluno({ ...profile, aluno_id: alunoId }, alunoId);
      toast.success('Aluno vinculado e dados sincronizados!');
      await loadProfiles();
    }
    setLinkingId(null);
  };

  const unlinkAluno = async (profileId: string) => {
    const { error } = await supabase.from('student_profiles').update({ aluno_id: null }).eq('id', profileId);
    if (error) { toast.error('Erro ao desvincular: ' + error.message); }
    else { toast.success('Vinculo removido'); await loadProfiles(); }
  };

  const handleDelete = async (profile: StudentProfile) => {
    setDeletingId(profile.id);
    try {
      const { error } = await supabase.functions.invoke('delete-student-account', {
        body: { auth_user_id: profile.auth_user_id, aluno_id: profile.aluno_id, delete_aluno: true },
      });
      if (error) throw new Error(String(error));
      toast.success('Cadastro excluido definitivamente!');
      setConfirmDeleteId(null);
      await loadProfiles();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir cadastro');
    }
    setDeletingId(null);
  };

  const togglePortal = async (profile: StudentProfile) => {
    if (!profile.aluno_id) { toast.error('Aluno nao vinculado'); return; }
    setTogglingId(profile.id + '_portal');
    const newVal = !profile.aluno_portal_bloqueado;
    const { error } = await supabase.from('alunos').update({ portal_bloqueado: newVal }).eq('id', profile.aluno_id);
    if (error) { toast.error('Erro: ' + error.message); }
    else { toast.success(newVal ? 'Portal bloqueado!' : 'Portal liberado!'); await loadProfiles(); }
    setTogglingId(null);
  };

  const toggleInadimplente = async (profile: StudentProfile) => {
    if (!profile.aluno_id) { toast.error('Aluno nao vinculado'); return; }
    setTogglingId(profile.id + '_inad');
    const newVal = !profile.aluno_inadimplente;
    const { error } = await supabase.from('alunos').update({ inadimplente: newVal }).eq('id', profile.aluno_id);
    if (error) { toast.error('Erro: ' + error.message); }
    else { toast.success(newVal ? 'Marcado como inadimplente!' : 'Situacao regularizada!'); await loadProfiles(); }
    setTogglingId(null);
  };

  const fieldRow = (label: string, value: string) => !value ? null : (
    <div className="flex gap-2 text-xs">
      <span className="text-muted-foreground min-w-[130px] flex-shrink-0">{label}:</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="loading-spinner" />
      <p className="text-sm text-muted-foreground">Carregando fichas...</p>
    </div>
  );

  if (loadError) return (
    <div className="content-card p-6 text-center">
      <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
      <p className="font-semibold text-foreground">Erro ao carregar fichas</p>
      <p className="text-sm text-muted-foreground mt-1">{loadError}</p>
      <Button className="mt-4" onClick={loadProfiles}>Tentar novamente</Button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Info */}
      <div className="content-card p-4 border-blue-200 bg-blue-50">
        <p className="text-sm text-blue-800">
          <strong>Fichas Online ({profiles.length}):</strong> Gerencie os alunos cadastrados pelo Portal.
          Use <strong>Bloquear Portal</strong> para suspender acesso, <strong>Inadimplente</strong> para marcar pendencia,
          <strong> WhatsApp</strong> para cobranca automatica e <strong>Excluir</strong> para remocao definitiva.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total de Fichas', value: profiles.length, color: 'text-primary', bg: 'bg-primary/5' },
          { label: 'Vinculados', value: profiles.filter(p => p.aluno_id).length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Sem Vinculo', value: profiles.filter(p => !p.aluno_id).length, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Inadimplentes', value: profiles.filter(p => p.aluno_inadimplente).length, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`content-card p-4 ${s.bg}`}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {profiles.length === 0 ? (
        <div className="empty-state py-16">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-foreground">Nenhum aluno cadastrou conta ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map(profile => {
            const isExpanded = expanded === profile.id;
            const profileDocs = docs[profile.auth_user_id] || [];
            const isLinked = !!profile.aluno_id;
            const phoneForWA = profile.celular1 || profile.telefone || profile.aluno_celular1 || profile.aluno_telefone;

            return (
              <div key={profile.id} className="content-card overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  {/* Status icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    profile.aluno_portal_bloqueado ? 'bg-red-100' :
                    profile.aluno_inadimplente ? 'bg-orange-100' :
                    isLinked ? 'bg-emerald-100' : 'bg-amber-100'
                  }`}>
                    {profile.aluno_portal_bloqueado ? <ShieldOff className="w-5 h-5 text-red-600" /> :
                      profile.aluno_inadimplente ? <AlertTriangle className="w-5 h-5 text-orange-600" /> :
                      isLinked ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
                      <AlertCircle className="w-5 h-5 text-amber-600" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Name + badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <p className="font-semibold text-sm text-foreground">{profile.nome_completo || '(sem nome)'}</p>
                      {isLinked ? (
                        <span className="badge-pago text-xs px-2 py-0.5 rounded-full">
                          {profile.aluno_nome}{profile.aluno_matricula ? ` (${profile.aluno_matricula})` : ''}
                        </span>
                      ) : (
                        <span className="badge-pendente text-xs px-2 py-0.5 rounded-full">Sem vinculo</span>
                      )}
                      {profile.aluno_inadimplente && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">Inadimplente</span>
                      )}
                      {profile.aluno_portal_bloqueado && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 font-semibold">Bloqueado</span>
                      )}
                    </div>
                    {/* Meta */}
                    <div className="flex flex-wrap gap-3 mb-2">
                      {profile.email_contato && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />{profile.email_contato}
                        </span>
                      )}
                      {(profile.celular1 || profile.telefone) && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />{profile.celular1 || profile.telefone}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Cadastro: {profile.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs px-2"
                        onClick={() => toggleExpand(profile.id, profile.auth_user_id)}>
                        <Eye className="w-3 h-3" />
                        <span className="hidden sm:inline">Ficha</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </Button>

                      {isLinked && (
                        <Button variant="outline" size="sm" onClick={() => togglePortal(profile)}
                          disabled={togglingId === profile.id + '_portal'}
                          className={`gap-1 h-7 text-xs px-2 ${profile.aluno_portal_bloqueado ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' : 'border-orange-300 text-orange-700 hover:bg-orange-50'}`}>
                          {togglingId === profile.id + '_portal'
                            ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                            : profile.aluno_portal_bloqueado ? <ShieldCheck className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                          {profile.aluno_portal_bloqueado ? 'Liberar Portal' : 'Bloquear Portal'}
                        </Button>
                      )}

                      {isLinked && (
                        <Button variant="outline" size="sm" onClick={() => toggleInadimplente(profile)}
                          disabled={togglingId === profile.id + '_inad'}
                          className={`gap-1 h-7 text-xs px-2 ${profile.aluno_inadimplente ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' : 'border-red-300 text-red-700 hover:bg-red-50'}`}>
                          {togglingId === profile.id + '_inad'
                            ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                            : <DollarSign className="w-3 h-3" />}
                          {profile.aluno_inadimplente ? 'Regularizar' : 'Inadimplente'}
                        </Button>
                      )}

                      {phoneForWA && (
                        <a href={buildWhatsAppLink(phoneForWA, profile.nome_completo || profile.aluno_nome)}
                          target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm"
                            className="gap-1 h-7 text-xs px-2 border-green-300 text-green-700 hover:bg-green-50">
                            <MessageCircle className="w-3 h-3" />
                            WhatsApp
                          </Button>
                        </a>
                      )}

                      {confirmDeleteId === profile.id ? (
                        <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                          <span className="text-xs text-red-700 font-medium">Confirmar exclusao?</span>
                          <Button size="sm" className="h-6 text-xs px-2 bg-red-600 hover:bg-red-700 text-white"
                            disabled={deletingId === profile.id}
                            onClick={() => handleDelete(profile)}>
                            {deletingId === profile.id
                              ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              : 'Sim, excluir'}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2"
                            onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(profile.id)}
                          className="gap-1 h-7 text-xs px-2 border-red-300 text-red-700 hover:bg-red-50">
                          <Trash2 className="w-3 h-3" />
                          Excluir
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-4 space-y-4 bg-muted/20">
                    {/* Link aluno */}
                    <div className="p-3 rounded-xl bg-background border border-border">
                      <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-primary" />Vincular ao Cadastro de Aluno
                      </p>
                      {isLinked ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm text-emerald-600 font-medium">
                            Vinculado: {profile.aluno_nome}{profile.aluno_matricula ? ` (${profile.aluno_matricula})` : ''}
                          </span>
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                            disabled={syncingId === profile.id} onClick={() => handleSync(profile)}>
                            {syncingId === profile.id
                              ? <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                              : <RefreshCw className="w-3 h-3" />}
                            Sincronizar
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => unlinkAluno(profile.id)}>Desvincular</Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Select value={selectedAluno[profile.id] || 'none'}
                            onValueChange={v => setSelectedAluno(p => ({ ...p, [profile.id]: v }))}>
                            <SelectTrigger className="form-input h-8 text-xs flex-1">
                              <SelectValue placeholder="Selecionar aluno..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Selecionar aluno...</SelectItem>
                              {alunos.map(a => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.nome}{a.matricula ? ` (${a.matricula})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" className="btn-primary h-8 text-xs gap-1"
                            disabled={!selectedAluno[profile.id] || selectedAluno[profile.id] === 'none' || linkingId === profile.id}
                            onClick={() => linkAluno(profile.id, selectedAluno[profile.id])}>
                            {linkingId === profile.id
                              ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              : <Link2 className="w-3 h-3" />}
                            Vincular
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Dados Pessoais */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />Dados Pessoais
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {fieldRow('Nome Completo', profile.nome_completo)}
                        {fieldRow('Sexo', profile.sexo)}
                        {fieldRow('Estado Civil', profile.estado_civil)}
                        {fieldRow('Data de Nasc.', profile.data_nascimento)}
                        {fieldRow('Cidade/UF Nasc.', [profile.cidade_nascimento, profile.uf_nascimento].filter(Boolean).join('/'))}
                        {fieldRow('RG', profile.rg)}
                        {fieldRow('CPF', profile.cpf)}
                        {fieldRow('Profissao', profile.profissao)}
                        {fieldRow('Nome do Pai', profile.nome_pai)}
                        {fieldRow('Nome da Mae', profile.nome_mae)}
                      </div>
                    </div>

                    {/* Endereco */}
                    {(profile.endereco || profile.cidade) && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />Endereco
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {fieldRow('Endereco', profile.endereco)}
                          {fieldRow('Bairro', profile.bairro)}
                          {fieldRow('CEP', profile.cep)}
                          {fieldRow('Cidade/UF', [profile.cidade, profile.uf].filter(Boolean).join('/'))}
                          {fieldRow('Telefone', profile.telefone)}
                          {fieldRow('Celular 1', profile.celular1)}
                          {fieldRow('Celular 2', profile.celular2)}
                        </div>
                      </div>
                    )}

                    {/* Eclesiastico */}
                    {(profile.igreja_membro || profile.data_conversao) && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dados Eclesiasticos</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {fieldRow('Conversao', profile.data_conversao)}
                          {fieldRow('Batismo em Aguas', profile.data_batismo)}
                          {fieldRow('Igreja Membro', profile.igreja_membro)}
                          {fieldRow('Congregacao', profile.congregacao)}
                          {fieldRow('Funcao na Igreja', profile.funcao_igreja)}
                        </div>
                      </div>
                    )}

                    {/* Escolaridade */}
                    {(profile.nivel_formacao || profile.instituicao) && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" />Escolaridade
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {fieldRow('Nivel de Formacao', profile.nivel_formacao)}
                          {fieldRow('Carga Horaria', profile.carga_horaria)}
                          {fieldRow('Instituicao', profile.instituicao)}
                          {fieldRow('Ano de Termino', profile.ano_termino)}
                        </div>
                      </div>
                    )}

                    {/* Habilidades */}
                    {profile.habilidades && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Habilidades</p>
                        <p className="text-xs text-foreground bg-background p-3 rounded-lg border border-border">{profile.habilidades}</p>
                      </div>
                    )}

                    {/* Documentos */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />Documentos ({profileDocs.length}/6)
                      </p>
                      {profileDocs.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Nenhum documento enviado.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {profileDocs.map(doc => (
                            <a key={doc.tipo} href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border hover:border-primary/40 transition-colors group">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground">{doc.tipo}</p>
                                <p className="text-xs text-muted-foreground truncate">{doc.nome_arquivo}</p>
                              </div>
                              <FileText className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FichasTab;
