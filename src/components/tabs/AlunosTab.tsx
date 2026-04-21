import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Aluno, Turma } from '@/types/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit2, Search, Users, Phone, Mail, Check, X, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = { nome: '', matricula: '', telefone: '', email: '', turmaId: '', ativo: true };

const AlunosTab = () => {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filterTurma, setFilterTurma] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const [aRes, tRes] = await Promise.all([
      supabase.from('alunos').select('*, classes(id, nome, turno, disciplina, professor, dias_semana, nucleo, created_at)').order('nome'),
      supabase.from('classes').select('*').order('nome'),
    ]);
    if (tRes.data) setTurmas(tRes.data.map(r => ({ id: r.id, nome: r.nome, turno: r.turno, disciplina: r.disciplina ?? '', professor: r.professor ?? '', diasSemana: r.dias_semana ?? '', nucleo: r.nucleo ?? '', createdAt: r.created_at })));
    if (aRes.data) setAlunos(aRes.data.map((r: Record<string, unknown>) => ({
      id: r.id, nome: r.nome, matricula: r.matricula ?? '', telefone: r.telefone ?? '',
      email: r.email ?? '', turmaId: r.turma_id, ativo: r.ativo ?? true, createdAt: r.created_at,
      turma: r.classes ? { id: r.classes.id, nome: r.classes.nome, turno: r.classes.turno, disciplina: r.classes.disciplina ?? '', professor: r.classes.professor ?? '', diasSemana: r.classes.dias_semana ?? '', nucleo: r.classes.nucleo ?? '', createdAt: r.classes.created_at } : undefined,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    const payload = { nome: form.nome, matricula: form.matricula, telefone: form.telefone, email: form.email, turma_id: form.turmaId || null, ativo: form.ativo };
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
    setForm({ nome: a.nome, matricula: a.matricula, telefone: a.telefone, email: a.email, turmaId: a.turmaId ?? '', ativo: a.ativo });
    setEditingId(a.id); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from('alunos').update({ ativo: !ativo }).eq('id', id);
    load();
  };

  const filtered = alunos.filter(a => {
    const matchSearch = a.nome.toLowerCase().includes(search.toLowerCase()) || a.matricula.toLowerCase().includes(search.toLowerCase());
    const matchTurma = filterTurma === 'all' || a.turmaId === filterTurma;
    const matchStatus = filterStatus === 'all' || (filterStatus === 'ativo' ? a.ativo : !a.ativo);
    return matchSearch && matchTurma && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: alunos.length, icon: Users, color: 'text-primary' },
          { label: 'Ativos', value: alunos.filter(a => a.ativo).length, icon: UserCheck, color: 'text-emerald-600' },
          { label: 'Inativos', value: alunos.filter(a => !a.ativo).length, icon: UserX, color: 'text-muted-foreground' },
          { label: 'Turmas', value: new Set(alunos.map(a => a.turmaId).filter(Boolean)).size, icon: Users, color: 'text-blue-600' },
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
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }} className="btn-primary gap-2 flex-shrink-0">
          {showForm && editingId === null ? <><X className="w-4 h-4" />Cancelar</> : <><Plus className="w-4 h-4" />Novo Aluno</>}
        </Button>
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
              <Input className="form-input" placeholder="Nº de matrícula" value={form.matricula} onChange={e => setForm(p => ({ ...p, matricula: e.target.value }))} />
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
              <Select value={form.turmaId} onValueChange={v => setForm(p => ({ ...p, turmaId: v }))}>
                <SelectTrigger className="form-input"><SelectValue placeholder="Selecionar turma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem turma</SelectItem>
                  {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome} — {t.turno}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div onClick={() => setForm(p => ({ ...p, ativo: !p.ativo }))} className={`w-10 h-5.5 rounded-full transition-colors flex items-center px-0.5 ${form.ativo ? 'bg-emerald-500' : 'bg-border'}`} style={{ height: '1.375rem' }}>
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
                  <th className="table-th text-center">Status</th>
                  <th className="table-th text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((a, i) => (
                  <tr key={a.id} className="table-row">
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">{a.nome.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{a.nome}</p>
                          {a.email && <p className="text-xs text-muted-foreground hidden sm:block">{a.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="table-td hidden sm:table-cell text-sm text-muted-foreground">{a.matricula || '—'}</td>
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
                    <td className="table-td text-center">
                      <button onClick={() => toggleAtivo(a.id, a.ativo)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${a.ativo ? 'badge-pago' : 'badge-neutro'}`}>
                        {a.ativo ? <><UserCheck className="w-3 h-3" />Ativo</> : <><UserX className="w-3 h-3" />Inativo</>}
                      </button>
                    </td>
                    <td className="table-td text-right">
                      <div className="flex items-center justify-end gap-1">
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
    </div>
  );
};

export default AlunosTab;
