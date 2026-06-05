import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Aluno, Turma, TipoBolsa } from '@/types/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Search, Users, Phone, Check, X, UserCheck, UserX, Hash, Wand2, Pencil, GraduationCap, DollarSign, Upload, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Nota {
  id: string;
  disciplina_nome: string;
  disciplina_numero: number;
  nota: number | null;
  periodo: string;
}

interface MensalidadeRow {
  id: string;
  mes: string;
  valor: number;
  situacao: string;
  forma_pagamento: string;
  obs: string;
  comprovante_url: string;
  comprovante_path: string;
}

const MESES_LABELS: Record<string, string> = {
  '01':'Janeiro','02':'Fevereiro','03':'Março','04':'Abril','05':'Maio','06':'Junho',
  '07':'Julho','08':'Agosto','09':'Setembro','10':'Outubro','11':'Novembro','12':'Dezembro',
};
const mesLabel = (mes: string) => { const [y,m] = mes.split('-'); return `${MESES_LABELS[m]} ${y}`; };

const emptyForm = {
  nome: '', matricula: '', telefone: '', email: '',
  turmaId: '', ativo: true, tipoBolsa: '' as TipoBolsa,
};

const TIPO_BOLSA_OPTIONS: { value: TipoBolsa; label: string }[] = [
  { value: '', label: '— Nenhum —' },
  { value: 'Coordenador', label: 'Coordenador' },
  { value: 'Esposa do Coordenador', label: 'Esposa do Coordenador' },
  { value: 'Bolsista', label: 'Bolsista' },
  { value: 'Bolsista Parcial', label: 'Bolsista Parcial' },
];

const TIPO_BOLSA_STYLE: Record<string, string> = {
  'Coordenador': 'bg-blue-100 text-blue-700 border border-blue-200',
  'Esposa do Coordenador': 'bg-purple-100 text-purple-700 border border-purple-200',
  'Bolsista': 'bg-amber-100 text-amber-700 border border-amber-200',
  'Bolsista Parcial': 'bg-orange-100 text-orange-700 border border-orange-200',
};

type AlunoRow = {
  id: string; nome: string; matricula: string | null; telefone: string | null;
  email: string | null; turma_id: string | null; ativo: boolean; created_at: string;
  tipo_bolsa: string | null;
  classes: { id: string; nome: string; turno: string; disciplina: string | null; professor: string | null; dias_semana: string | null; nucleo: string | null; honorario: number | null; created_at: string } | null;
};

const generateMatricula = async (ano: number, coordenadorId: string): Promise<string> => {
  const prefix = String(ano);
  const { data } = await supabase.from('alunos').select('matricula').ilike('matricula', `${prefix}%`).eq('coordenador_id', coordenadorId);
  const nums = (data || [])
    .map(r => parseInt((r.matricula || '').replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
};

const AlunosTab = () => {
  const { coordenadorId } = useAuth();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filterTurma, setFilterTurma] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [generatingMatricula, setGeneratingMatricula] = useState(false);
  const [generatingAllMatriculas, setGeneratingAllMatriculas] = useState(false);

  // Notas state
  const [notasDialog, setNotasDialog] = useState<{ alunoId: string; nome: string } | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [notaForm, setNotaForm] = useState({ disciplina_nome: '', disciplina_numero: 1, nota: '', periodo: String(new Date().getFullYear()) });
  const [savingNota, setSavingNota] = useState(false);

  // Financeiro state
  const [finDialog, setFinDialog] = useState<{ alunoId: string; nome: string } | null>(null);
  const [mensalidadesAluno, setMensalidadesAluno] = useState<MensalidadeRow[]>([]);
  const [uploadingComp, setUploadingComp] = useState<string | null>(null); // mensalidade id being uploaded
  const finFileRefs = useState<Record<string, HTMLInputElement | null>>({})[0];

  const loadNotas = async (alunoId: string) => {
    const { data } = await supabase.from('notas_aluno').select('*')
      .eq('aluno_id', alunoId).order('disciplina_numero', { ascending: true });
    setNotas(data || []);
  };

  const handleOpenNotas = (a: Aluno) => {
    setNotasDialog({ alunoId: a.id, nome: a.nome });
    setNotaForm({ disciplina_nome: '', disciplina_numero: 1, nota: '', periodo: String(new Date().getFullYear()) });
    loadNotas(a.id);
  };

  const handleAddNota = async () => {
    if (!notasDialog || !notaForm.disciplina_nome.trim()) {
      toast.error('Informe o nome da disciplina');
      return;
    }
    setSavingNota(true);
    const notaVal = notaForm.nota !== '' ? parseFloat(notaForm.nota) : null;
    const { error } = await supabase.from('notas_aluno').insert({
      aluno_id: notasDialog.alunoId,
      disciplina_nome: notaForm.disciplina_nome.trim(),
      disciplina_numero: notaForm.disciplina_numero,
      nota: notaVal,
      periodo: notaForm.periodo,
      coordenador_id: coordenadorId,
    });
    if (error) { toast.error('Erro ao salvar nota'); }
    else {
      toast.success('Nota adicionada');
      setNotaForm({ disciplina_nome: '', disciplina_numero: notas.length + 2, nota: '', periodo: notaForm.periodo });
      loadNotas(notasDialog.alunoId);
    }
    setSavingNota(false);
  };

  const handleDeleteNota = async (id: string) => {
    await supabase.from('notas_aluno').delete().eq('id', id);
    if (notasDialog) loadNotas(notasDialog.alunoId);
  };

  const handleUpdateNota = async (id: string, nota: string) => {
    const val = nota !== '' ? parseFloat(nota) : null;
    await supabase.from('notas_aluno').update({ nota: val }).eq('id', id);
    if (notasDialog) loadNotas(notasDialog.alunoId);
  };

  // Financial helpers
  const loadMensalidadesAluno = async (alunoId: string) => {
    const { data } = await supabase.from('mensalidades').select('*').eq('aluno_id', alunoId).order('mes', { ascending: false });
    setMensalidadesAluno((data || []).map(r => ({
      id: r.id, mes: r.mes, valor: Number(r.valor) || 0,
      situacao: r.situacao || 'Pendente', forma_pagamento: r.forma_pagamento || '',
      obs: r.obs || '', comprovante_url: (r as { comprovante_url?: string }).comprovante_url || '',
      comprovante_path: (r as { comprovante_path?: string }).comprovante_path || '',
    })));
  };

  const handleOpenFinanceiro = (a: Aluno) => {
    setFinDialog({ alunoId: a.id, nome: a.nome });
    loadMensalidadesAluno(a.id);
  };

  const handleUploadComprovante = async (mensId: string, alunoId: string, mes: string, file: File) => {
    if (file.size > 20 * 1024 * 1024) { toast.error('Arquivo muito grande (máx 20 MB)'); return; }
    setUploadingComp(mensId);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${alunoId}/${mes}_${Date.now()}_${safeName}`;
      // Remove old comprovante if exists
      const old = mensalidadesAluno.find(m => m.id === mensId);
      if (old?.comprovante_path) {
        await supabase.storage.from('comprovantes').remove([old.comprovante_path]);
      }
      const { data: up, error } = await supabase.storage.from('comprovantes').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('comprovantes').getPublicUrl(up.path);
      await supabase.from('mensalidades').update({ comprovante_url: publicUrl, comprovante_path: up.path }).eq('id', mensId);
      toast.success('Comprovante enviado!');
      loadMensalidadesAluno(alunoId);
    } catch { toast.error('Erro ao enviar comprovante'); }
    finally { setUploadingComp(null); }
  };

  const handleRemoveComprovante = async (mensId: string, alunoId: string, path: string) => {
    if (path) await supabase.storage.from('comprovantes').remove([path]);
    await supabase.from('mensalidades').update({ comprovante_url: '', comprovante_path: '' }).eq('id', mensId);
    toast.success('Comprovante removido');
    loadMensalidadesAluno(alunoId);
  };

  const load = useCallback(async () => {
    if (!coordenadorId) return;
    setLoading(true);
    const [aRes, tRes] = await Promise.all([
      supabase.from('alunos').select('*, classes(id, nome, turno, disciplina, professor, dias_semana, nucleo, honorario, created_at)').eq('coordenador_id', coordenadorId).order('nome'),
      supabase.from('classes').select('*').eq('coordenador_id', coordenadorId).order('nome'),
    ]);
    if (tRes.data) setTurmas(tRes.data.map(r => ({
      id: r.id, nome: r.nome, turno: r.turno as 'Manhã'|'Tarde'|'Noite', disciplina: r.disciplina ?? '',
      professor: r.professor ?? '', diasSemana: r.dias_semana ?? '', nucleo: r.nucleo ?? '',
      honorario: Number(r.honorario) || 0, createdAt: r.created_at,
    })));
    if (aRes.data) {
      setAlunos((aRes.data as AlunoRow[]).map(r => ({
        id: r.id, nome: r.nome, matricula: r.matricula ?? '', telefone: r.telefone ?? '',
        email: r.email ?? '', turmaId: r.turma_id, ativo: r.ativo ?? true, createdAt: r.created_at,
        tipoBolsa: (r.tipo_bolsa ?? '') as TipoBolsa,
        turma: r.classes ? { id: r.classes.id, nome: r.classes.nome, turno: r.classes.turno as 'Manhã'|'Tarde'|'Noite', disciplina: r.classes.disciplina ?? '', professor: r.classes.professor ?? '', diasSemana: r.classes.dias_semana ?? '', nucleo: r.classes.nucleo ?? '', honorario: Number(r.classes.honorario) || 0, createdAt: r.classes.created_at } : undefined,
      })));
    }
    setLoading(false);
  }, [coordenadorId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerateMatricula = async () => {
    if (!coordenadorId) return;
    setGeneratingMatricula(true);
    const matricula = await generateMatricula(new Date().getFullYear(), coordenadorId);
    setForm(p => ({ ...p, matricula }));
    setGeneratingMatricula(false);
  };

  const handleGenerateAllMatriculas = async () => {
    if (!coordenadorId) return;
    const semMatricula = alunos.filter(a => !a.matricula);
    if (semMatricula.length === 0) { toast.info('Todos os alunos já têm matrícula'); return; }
    setGeneratingAllMatriculas(true);
    const ano = new Date().getFullYear();
    const prefix = String(ano);
    const { data: existing } = await supabase.from('alunos').select('matricula').ilike('matricula', `${prefix}%`).eq('coordenador_id', coordenadorId);
    const usedNums = new Set(
      (existing || []).map(r => parseInt((r.matricula || '').replace(prefix, ''), 10)).filter(n => !isNaN(n))
    );
    let next = 1;
    const updates: Promise<unknown>[] = [];
    for (const a of semMatricula) {
      while (usedNums.has(next)) next++;
      const mat = `${prefix}${String(next).padStart(3, '0')}`;
      usedNums.add(next); next++;
      updates.push(supabase.from('alunos').update({ matricula: mat }).eq('id', a.id));
    }
    await Promise.all(updates);
    toast.success(`${semMatricula.length} matrículas geradas!`);
    setGeneratingAllMatriculas(false);
    load();
  };

  const save = async () => {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!coordenadorId) return;
    const payload = {
      nome: form.nome, matricula: form.matricula, telefone: form.telefone,
      email: form.email, turma_id: (form.turmaId && form.turmaId !== 'none') ? form.turmaId : null,
      ativo: form.ativo, tipo_bolsa: form.tipoBolsa || '', coordenador_id: coordenadorId,
    };
    if (editingId) {
      const { error } = await supabase.from('alunos').update(payload).eq('id', editingId);
      if (!error) { toast.success('Aluno atualizado'); } else { toast.error('Erro ao salvar'); }
    } else {
      const { error } = await supabase.from('alunos').insert(payload);
      if (!error) { toast.success('Aluno cadastrado'); } else { toast.error('Erro ao salvar'); }
    }
    setForm(emptyForm); setEditingId(null); setShowForm(false); load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from('alunos').delete().eq('id', id);
    if (!error) { toast.success('Aluno removido'); load(); } else { toast.error('Erro ao remover'); }
  };

  const edit = (a: Aluno) => {
    setForm({ nome: a.nome, matricula: a.matricula, telefone: a.telefone, email: a.email, turmaId: a.turmaId ?? '', ativo: a.ativo, tipoBolsa: a.tipoBolsa });
    setEditingId(a.id); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from('alunos').update({ ativo: !ativo }).eq('id', id);
    load();
  };

  const generateForAluno = async (a: Aluno) => {
    if (a.matricula) { toast.info('Aluno já possui matrícula'); return; }
    if (!coordenadorId) return;
    const matricula = await generateMatricula(new Date().getFullYear(), coordenadorId);
    await supabase.from('alunos').update({ matricula }).eq('id', a.id);
    toast.success(`Matrícula ${matricula} gerada`);
    load();
  };

  const filtered = alunos.filter(a => {
    const matchSearch = a.nome.toLowerCase().includes(search.toLowerCase()) || a.matricula.toLowerCase().includes(search.toLowerCase());
    const matchTurma = filterTurma === 'all' || a.turmaId === filterTurma;
    const matchStatus = filterStatus === 'all' || (filterStatus === 'ativo' ? a.ativo : !a.ativo);
    return matchSearch && matchTurma && matchStatus;
  });

  const semMatriculaCount = alunos.filter(a => !a.matricula).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: alunos.length, icon: Users, color: 'text-primary' },
          { label: 'Ativos', value: alunos.filter(a => a.ativo).length, icon: UserCheck, color: 'text-emerald-600' },
          { label: 'Inativos', value: alunos.filter(a => !a.ativo).length, icon: UserX, color: 'text-muted-foreground' },
          { label: 'Sem Matrícula', value: semMatriculaCount, icon: Hash, color: semMatriculaCount > 0 ? 'text-amber-600' : 'text-muted-foreground' },
        ].map(s => (
          <div key={s.label} className="content-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
              <s.icon className={`w-7 h-7 opacity-20 ${s.color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9 form-input" placeholder="Buscar aluno..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterTurma} onValueChange={setFilterTurma}>
            <SelectTrigger className="form-input w-auto min-w-[140px]"><SelectValue placeholder="Todas as turmas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as turmas</SelectItem>
              {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="form-input w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {semMatriculaCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleGenerateAllMatriculas} disabled={generatingAllMatriculas}
              className="gap-1.5 h-9 text-amber-700 border-amber-200 hover:bg-amber-50">
              <Wand2 className="w-3.5 h-3.5" />
              {generatingAllMatriculas ? 'Gerando...' : `Gerar ${semMatriculaCount} matrículas`}
            </Button>
          )}
          <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }} className="btn-primary gap-2">
            {showForm && editingId === null ? <><X className="w-4 h-4" />Cancelar</> : <><Plus className="w-4 h-4" />Novo Aluno</>}
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="content-card p-6 border-l-4 border-l-primary">
          <h3 className="font-semibold text-foreground mb-4">{editingId ? 'Editar Aluno' : 'Cadastrar Aluno'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="form-label">Nome Completo *</label>
              <Input className="form-input" placeholder="Nome do aluno" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Matrícula</label>
              <div className="flex gap-2">
                <Input className="form-input flex-1" placeholder="Auto-gerada se vazio" value={form.matricula}
                  onChange={e => setForm(p => ({ ...p, matricula: e.target.value }))} />
                <Button type="button" variant="outline" size="sm"
                  onClick={handleGenerateMatricula} disabled={generatingMatricula}
                  className="h-9 px-2.5 flex-shrink-0 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                  title="Gerar número de matrícula">
                  {generatingMatricula ? <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <Hash className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Clique em <Hash className="w-3 h-3 inline" /> para gerar automaticamente</p>
            </div>
            <div>
              <label className="form-label">Telefone</label>
              <Input className="form-input" placeholder="(00) 00000-0000" value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">E-mail</label>
              <Input className="form-input" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Turma</label>
              <Select value={form.turmaId || 'none'} onValueChange={v => setForm(p => ({ ...p, turmaId: v === 'none' ? '' : v }))}>
                <SelectTrigger className="form-input"><SelectValue placeholder="Selecionar turma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem turma —</SelectItem>
                  {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome} — {t.turno}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="form-label">Tipo / Bolsa</label>
              <Select value={form.tipoBolsa || 'none-bolsa'} onValueChange={v => setForm(p => ({ ...p, tipoBolsa: v === 'none-bolsa' ? '' : v as TipoBolsa }))}>
                <SelectTrigger className="form-input"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none-bolsa">— Nenhum —</SelectItem>
                  {TIPO_BOLSA_OPTIONS.filter(o => o.value !== '').map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div onClick={() => setForm(p => ({ ...p, ativo: !p.ativo }))}
                  className={`w-10 rounded-full transition-colors flex items-center px-0.5 ${form.ativo ? 'bg-emerald-500' : 'bg-border'}`}
                  style={{ height: '1.375rem' }}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.ativo ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm text-foreground">{form.ativo ? 'Ativo' : 'Inativo'}</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <Button onClick={save} className="btn-primary gap-2"><Check className="w-4 h-4" />Salvar</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="loading-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{alunos.length === 0 ? 'Nenhum aluno cadastrado' : 'Nenhum resultado encontrado'}</p>
          <p className="text-sm mt-1">{alunos.length === 0 ? 'Clique em "Novo Aluno" para cadastrar' : 'Tente outros filtros'}</p>
        </div>
      ) : (
        <div className="content-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-head">
                  <th className="table-th text-left">Nome</th>
                  <th className="table-th text-left hidden sm:table-cell">Matrícula</th>
                  <th className="table-th text-left hidden md:table-cell">Telefone</th>
                  <th className="table-th text-left hidden lg:table-cell">Turma</th>
                  <th className="table-th text-left hidden xl:table-cell">Bolsa</th>
                  <th className="table-th text-center">Status</th>
                  <th className="table-th text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((a) => (
                  <tr key={a.id} className="table-row">
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 text-xs font-bold
                          ${a.tipoBolsa === 'Coordenador' ? 'bg-blue-100 border-blue-200 text-blue-700'
                          : a.tipoBolsa === 'Esposa do Coordenador' ? 'bg-purple-100 border-purple-200 text-purple-700'
                          : 'bg-primary/10 border-primary/20 text-primary'}`}>
                          {a.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{a.nome}</p>
                          {a.tipoBolsa && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TIPO_BOLSA_STYLE[a.tipoBolsa] || 'bg-muted text-muted-foreground'}`}>
                              {a.tipoBolsa}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="table-td hidden sm:table-cell">
                      {a.matricula ? (
                        <span className="font-mono text-sm font-medium text-foreground bg-muted/60 px-2 py-0.5 rounded">{a.matricula}</span>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => generateForAluno(a)}
                          className="h-7 px-2 text-xs gap-1 text-amber-600 hover:bg-amber-50 hover:text-amber-700">
                          <Hash className="w-3 h-3" />Gerar
                        </Button>
                      )}
                    </td>
                    <td className="table-td hidden md:table-cell text-sm text-muted-foreground">
                      {a.telefone ? <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{a.telefone}</span> : '—'}
                    </td>
                    <td className="table-td hidden lg:table-cell text-sm">
                      {a.turma ? (
                        <div>
                          <p className="font-medium text-foreground">{a.turma.nome}</p>
                          <p className="text-xs text-muted-foreground">{a.turma.turno}</p>
                        </div>
                      ) : <span className="text-muted-foreground text-xs">Sem turma</span>}
                    </td>
                    <td className="table-td hidden xl:table-cell">
                      <div className="flex items-center gap-1.5">
                        {a.tipoBolsa ? (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${TIPO_BOLSA_STYLE[a.tipoBolsa] || 'bg-muted text-muted-foreground'}`}>
                            {a.tipoBolsa}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-50 hover:opacity-100 hover:bg-primary/10 hover:text-primary flex-shrink-0" title="Editar bolsa">
                              <Pencil className="w-3 h-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-52 p-3" align="start">
                            <p className="text-xs font-semibold text-foreground mb-2">Alterar Tipo/Bolsa</p>
                            <Select
                              value={a.tipoBolsa || 'none-bolsa'}
                              onValueChange={async (v) => {
                                const newVal = v === 'none-bolsa' ? '' : v as TipoBolsa;
                                await supabase.from('alunos').update({ tipo_bolsa: newVal }).eq('id', a.id);
                                load();
                                toast.success('Bolsa atualizada');
                              }}>
                              <SelectTrigger className="h-8 text-xs form-input w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none-bolsa">— Nenhum —</SelectItem>
                                {TIPO_BOLSA_OPTIONS.filter(o => o.value !== '').map(o => (
                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </td>
                    <td className="table-td text-center">
                      <button onClick={() => toggleAtivo(a.id, a.ativo)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${a.ativo ? 'badge-pago' : 'badge-neutro'}`}>
                        {a.ativo ? <><UserCheck className="w-3 h-3" />Ativo</> : <><UserX className="w-3 h-3" />Inativo</>}
                      </button>
                    </td>
                    <td className="table-td text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenNotas(a)} className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary" title="Gerenciar notas"><GraduationCap className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenFinanceiro(a)} className="h-8 w-8 p-0 hover:bg-emerald-50 hover:text-emerald-600" title="Financeiro / Comprovantes"><DollarSign className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => edit(a)} className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => del(a.id)} className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            Mostrando {filtered.length} de {alunos.length} aluno{alunos.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Dialog de Notas */}
      <Dialog open={!!notasDialog} onOpenChange={open => !open && setNotasDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Notas — {notasDialog?.nome}
            </DialogTitle>
          </DialogHeader>

          {/* Add nota form */}
          <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Adicionar Disciplina</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="form-label">Nr</Label>
                <Input type="number" className="form-input mt-1" min={1}
                  value={notaForm.disciplina_numero}
                  onChange={e => setNotaForm(p => ({ ...p, disciplina_numero: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label className="form-label">Período</Label>
                <Input className="form-input mt-1" placeholder="Ex: 2026"
                  value={notaForm.periodo}
                  onChange={e => setNotaForm(p => ({ ...p, periodo: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="form-label">Disciplina</Label>
              <Input className="form-input mt-1" placeholder="Nome da disciplina"
                value={notaForm.disciplina_nome}
                onChange={e => setNotaForm(p => ({ ...p, disciplina_nome: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAddNota()} />
            </div>
            <div>
              <Label className="form-label">Média (deixe vazio se ainda não lançada)</Label>
              <Input type="number" className="form-input mt-1" placeholder="0.0 – 10.0" step="0.1" min={0} max={10}
                value={notaForm.nota}
                onChange={e => setNotaForm(p => ({ ...p, nota: e.target.value }))} />
            </div>
            <Button onClick={handleAddNota} disabled={savingNota} className="btn-primary gap-2 w-full">
              <Plus className="w-4 h-4" />Adicionar Disciplina
            </Button>
          </div>

          {/* Notas list */}
          {notas.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="table-head">
                    <th className="table-th text-center w-10">Nr</th>
                    <th className="table-th text-left">Disciplina</th>
                    <th className="table-th text-center w-20">Média</th>
                    <th className="table-th text-center w-16">Período</th>
                    <th className="table-th w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {notas.map(n => (
                    <tr key={n.id} className="table-row">
                      <td className="table-td text-center">
                        <span className="text-xs font-mono text-muted-foreground">{n.disciplina_numero}</span>
                      </td>
                      <td className="table-td">
                        <span className="text-sm font-medium text-foreground">{n.disciplina_nome}</span>
                      </td>
                      <td className="table-td text-center">
                        <Input
                          type="number"
                          className="form-input h-7 text-center w-16 text-sm mx-auto"
                          step="0.1" min={0} max={10}
                          defaultValue={n.nota !== null ? String(n.nota) : ''}
                          onBlur={e => handleUpdateNota(n.id, e.target.value)}
                        />
                      </td>
                      <td className="table-td text-center">
                        <span className="text-xs text-muted-foreground">{n.periodo}</span>
                      </td>
                      <td className="table-td text-center">
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteNota(n.id)}
                          className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {notas.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Nenhuma nota lançada. Use o formulário acima para adicionar.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Financeiro */}
      <Dialog open={!!finDialog} onOpenChange={open => !open && setFinDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Financeiro — {finDialog?.nome}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Mensalidades registradas no sistema</p>
            <Button variant="ghost" size="sm" onClick={() => finDialog && loadMensalidadesAluno(finDialog.alunoId)} className="h-7 gap-1 text-xs">
              <RefreshCw className="w-3 h-3" />Atualizar
            </Button>
          </div>

          {mensalidadesAluno.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-20" />
              Nenhuma mensalidade registrada para este aluno
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="table-head">
                    <th className="table-th text-left">Mês</th>
                    <th className="table-th text-right">Valor</th>
                    <th className="table-th text-center">Situação</th>
                    <th className="table-th text-center">Comprovante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mensalidadesAluno.map(m => (
                    <tr key={m.id} className="table-row">
                      <td className="table-td">
                        <p className="font-medium text-sm text-foreground">{mesLabel(m.mes)}</p>
                        {m.forma_pagamento && <p className="text-xs text-muted-foreground">{m.forma_pagamento}</p>}
                      </td>
                      <td className="table-td text-right">
                        <span className="font-semibold text-sm text-foreground">
                          {m.valor > 0 ? `R$ ${m.valor.toFixed(2).replace('.',',')}` : '—'}
                        </span>
                      </td>
                      <td className="table-td text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          m.situacao === 'Pago' ? 'bg-emerald-100 text-emerald-700' :
                          m.situacao === 'Atrasado' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {m.situacao === 'Pago' && <Check className="w-3 h-3" />}
                          {m.situacao}
                        </span>
                      </td>
                      <td className="table-td text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {m.comprovante_url ? (
                            <>
                              <a href={m.comprovante_url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                                <ExternalLink className="w-3 h-3" />Ver PDF
                              </a>
                              <button onClick={() => finDialog && handleRemoveComprovante(m.id, finDialog.alunoId, m.comprovante_path)}
                                className="text-muted-foreground hover:text-destructive transition-colors ml-1" title="Remover">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <input
                                type="file"
                                id={`comp-${m.id}`}
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                ref={el => { finFileRefs[m.id] = el; }}
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file && finDialog) handleUploadComprovante(m.id, finDialog.alunoId, m.mes, file);
                                }}
                              />
                              <Button variant="outline" size="sm"
                                onClick={() => finFileRefs[m.id]?.click()}
                                disabled={uploadingComp === m.id}
                                className="h-7 text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                                {uploadingComp === m.id
                                  ? <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-600 rounded-full animate-spin" />
                                  : <Upload className="w-3 h-3" />}
                                {uploadingComp === m.id ? 'Enviando...' : 'Enviar PDF'}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlunosTab;
