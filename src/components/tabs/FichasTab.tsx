import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, FileText, Eye, Link2, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, Mail, Phone, MapPin, BookOpen, Upload,
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
  rg: string; cpf: string;
  endereco: string; bairro: string; cep: string; cidade: string; uf: string;
  telefone: string; celular1: string; celular2: string;
  nome_pai: string; nome_mae: string; profissao: string;
  data_conversao: string; data_batismo: string;
  igreja_membro: string; congregacao: string; funcao_igreja: string;
  nivel_formacao: string; carga_horaria: string; instituicao: string; ano_termino: string;
  habilidades: string;
  created_at: string;
  aluno_nome?: string;
  aluno_matricula?: string;
}

interface DocItem {
  tipo: string; nome_arquivo: string; url: string; uploaded_at: string;
}

interface Aluno {
  id: string; nome: string; matricula: string;
}

const DOCS_LABELS: Record<string, string> = {
  foto3x4: 'Foto 3x4',
  identidade: 'Identidade',
  certidao: 'Certidão',
  comprovante_residencia: 'Comp. Residência',
  comprovante_escolaridade: 'Comp. Escolaridade',
  carta_recomendacao: 'Carta Recomendação',
};

const FichasTab = () => {
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, DocItem[]>>({});
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [selectedAluno, setSelectedAluno] = useState<Record<string, string>>({});

  useEffect(() => {
    loadProfiles();
    loadAlunos();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('student_profiles')
      .select('*, alunos(nome, matricula)')
      .order('created_at', { ascending: false });

    if (error) { toast.error('Erro ao carregar fichas'); setLoading(false); return; }

    const list: StudentProfile[] = (data || []).map(p => ({
      ...p,
      aluno_nome: (p.alunos as { nome?: string } | null)?.nome || '',
      aluno_matricula: (p.alunos as { matricula?: string } | null)?.matricula || '',
    }));
    setProfiles(list);
    setLoading(false);
  };

  const loadAlunos = async () => {
    const { data } = await supabase.from('alunos').select('id, nome, matricula').eq('ativo', true).order('nome');
    if (data) setAlunos(data as Aluno[]);
  };

  const loadDocs = async (authUserId: string) => {
    if (docs[authUserId]) return; // already loaded
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

  const linkAluno = async (profileId: string, alunoId: string) => {
    if (!alunoId || alunoId === 'none') return;
    setLinkingId(profileId);
    const { error } = await supabase.from('student_profiles').update({ aluno_id: alunoId }).eq('id', profileId);
    if (error) { toast.error('Erro ao vincular aluno'); }
    else {
      toast.success('Aluno vinculado com sucesso!');
      await loadProfiles();
    }
    setLinkingId(null);
  };

  const unlinkAluno = async (profileId: string) => {
    const { error } = await supabase.from('student_profiles').update({ aluno_id: null }).eq('id', profileId);
    if (error) { toast.error('Erro ao desvincular'); }
    else { toast.success('Vínculo removido'); await loadProfiles(); }
  };

  const fieldRow = (label: string, value: string) => value ? (
    <div className="flex gap-2 text-xs">
      <span className="text-muted-foreground min-w-[130px] flex-shrink-0">{label}:</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  ) : null;

  if (loading) return <div className="flex justify-center py-16"><div className="loading-spinner" /></div>;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="content-card p-4 bg-primary/5">
          <p className="text-xs text-muted-foreground">Total de Fichas</p>
          <p className="text-2xl font-bold text-primary">{profiles.length}</p>
        </div>
        <div className="content-card p-4 bg-emerald-50">
          <p className="text-xs text-muted-foreground">Vinculados</p>
          <p className="text-2xl font-bold text-emerald-600">{profiles.filter(p => p.aluno_id).length}</p>
        </div>
        <div className="content-card p-4 bg-amber-50">
          <p className="text-xs text-muted-foreground">Sem Vínculo</p>
          <p className="text-2xl font-bold text-amber-600">{profiles.filter(p => !p.aluno_id).length}</p>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="empty-state py-16">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-foreground">Nenhum aluno cadastrou conta ainda</p>
          <p className="text-sm text-muted-foreground mt-1">
            Quando um aluno criar conta no Portal do Aluno, a ficha aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map(profile => {
            const isExpanded = expanded === profile.id;
            const profileDocs = docs[profile.auth_user_id] || [];
            const isLinked = !!profile.aluno_id;

            return (
              <div key={profile.id} className="content-card overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 p-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLinked ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    {isLinked
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      : <AlertCircle className="w-5 h-5 text-amber-600" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-sm text-foreground truncate">{profile.nome_completo || '(sem nome)'}</p>
                      {isLinked && (
                        <span className="badge-pago text-xs px-2 py-0.5 rounded-full">
                          Vinculado: {profile.aluno_nome}
                          {profile.aluno_matricula && ` (${profile.aluno_matricula})`}
                        </span>
                      )}
                      {!isLinked && (
                        <span className="badge-pendente text-xs px-2 py-0.5 rounded-full">Sem vínculo</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-0.5">
                      {profile.email_contato && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />{profile.email_contato}
                        </span>
                      )}
                      {profile.telefone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />{profile.telefone}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Cadastro: {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost" size="sm"
                    className="gap-1.5 h-8 text-xs flex-shrink-0"
                    onClick={() => toggleExpand(profile.id, profile.auth_user_id)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:block">Ver Ficha</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </Button>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-4 space-y-5 bg-muted/20">

                    {/* Vincular aluno */}
                    <div className="p-3 rounded-xl bg-background border border-border">
                      <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-primary" />
                        Vincular ao Cadastro de Aluno
                      </p>
                      {isLinked ? (
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-emerald-600 font-medium">
                            Vinculado: {profile.aluno_nome} ({profile.aluno_matricula})
                          </span>
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => unlinkAluno(profile.id)}>
                            Desvincular
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Select
                            value={selectedAluno[profile.id] || 'none'}
                            onValueChange={v => setSelectedAluno(p => ({ ...p, [profile.id]: v }))}
                          >
                            <SelectTrigger className="form-input h-8 text-xs flex-1">
                              <SelectValue placeholder="Selecionar aluno..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Selecionar aluno...</SelectItem>
                              {alunos.map(a => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.nome} {a.matricula ? `(${a.matricula})` : ''}
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
                        {fieldRow('Órgão Exp.', profile.orgao_expedidor)}
                        {fieldRow('Profissão', profile.profissao)}
                        {fieldRow('Nome do Pai', profile.nome_pai)}
                        {fieldRow('Nome da Mãe', profile.nome_mae)}
                      </div>
                    </div>

                    {/* Endereço */}
                    {(profile.endereco || profile.cidade) && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />Endereço
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {fieldRow('Endereço', profile.endereco)}
                          {fieldRow('Bairro', profile.bairro)}
                          {fieldRow('CEP', profile.cep)}
                          {fieldRow('Cidade/UF', [profile.cidade, profile.uf].filter(Boolean).join('/'))}
                          {fieldRow('Telefone', profile.telefone)}
                          {fieldRow('Celular 1', profile.celular1)}
                          {fieldRow('Celular 2', profile.celular2)}
                        </div>
                      </div>
                    )}

                    {/* Dados Eclesiásticos */}
                    {(profile.igreja_membro || profile.data_conversao) && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Dados Eclesiásticos
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {fieldRow('Conversão', profile.data_conversao)}
                          {fieldRow('Batismo em Águas', profile.data_batismo)}
                          {fieldRow('Igreja Membro', profile.igreja_membro)}
                          {fieldRow('Congregação', profile.congregacao)}
                          {fieldRow('Função na Igreja', profile.funcao_igreja)}
                        </div>
                      </div>
                    )}

                    {/* Dados do Curso */}
                    {(profile.nivel_formacao || profile.instituicao) && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" />Escolaridade
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {fieldRow('Nível de Formação', profile.nivel_formacao)}
                          {fieldRow('Carga Horária', profile.carga_horaria)}
                          {fieldRow('Instituição', profile.instituicao)}
                          {fieldRow('Ano de Término', profile.ano_termino)}
                        </div>
                      </div>
                    )}

                    {/* Habilidades */}
                    {profile.habilidades && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Habilidades e Competências</p>
                        <p className="text-xs text-foreground bg-background p-3 rounded-lg border border-border">{profile.habilidades}</p>
                      </div>
                    )}

                    {/* Documentos */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />Documentos Enviados ({profileDocs.length}/6)
                      </p>
                      {profileDocs.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Nenhum documento enviado ainda.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {profileDocs.map(doc => (
                            <a key={doc.tipo} href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border hover:border-primary/40 transition-colors group">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground">{DOCS_LABELS[doc.tipo] || doc.tipo}</p>
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
