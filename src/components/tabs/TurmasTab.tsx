import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Turma, Turno, Modulo, DisciplinaTurma } from '@/types/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Trash2, Edit2, Building2, Clock, BookOpen, User, Check, X,
  ChevronDown, ChevronUp, Layers, GraduationCap, DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';

const TURNOS: Turno[] = ['Manhã', 'Tarde', 'Noite'];
const TURNO_COLOR: Record<Turno, string> = {
  'Manhã': 'badge-manha',
  'Tarde': 'badge-tarde',
  'Noite': 'badge-noite',
};

const emptyForm = {
  nome: '', turno: 'Noite' as Turno, diasSemana: '', nucleo: '',
  dataAula: '', horario: '',
};

const emptyDisc = { nome: '', professor: '', honorario: '', horario: '' };

interface TurmaWithModulos extends Turma {
  modulos: Modulo[];
}

// ─── Discipline inline form ────────────────────────────────────────────────────
interface DiscFormState {
  id?: string;
  nome: string; professor: string; honorario: string; horario: string;
}

const DiscForm = ({ disc, onSave, onCancel }: {
  disc: DiscFormState;
  onSave: (d: DiscFormState) => void;
  onCancel: () => void;
}) => {
  const [f, setF] = useState(disc);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-muted/20 rounded-lg border border-dashed border-border">
      <div>
        <label className="form-label text-xs">Disciplina *</label>
        <Input className="form-input h-8 text-xs" placeholder="Nome da disciplina"
          value={f.nome} onChange={e => setF(p => ({ ...p, nome: e.target.value }))} />
      </div>
      <div>
        <label className="form-label text-xs">Professor</label>
        <Input className="form-input h-8 text-xs" placeholder="Nome do professor"
          value={f.professor} onChange={e => setF(p => ({ ...p, professor: e.target.value }))} />
      </div>
      <div>
        <label className="form-label text-xs">Honorário (R$)</label>
        <Input type="number" min="0" step="10" className="form-input h-8 text-xs" placeholder="0,00"
          value={f.honorario} onChange={e => setF(p => ({ ...p, honorario: e.target.value }))} />
      </div>
      <div>
        <label className="form-label text-xs">Horário</label>
        <Input className="form-input h-8 text-xs" placeholder="Ex: 19h - 21h"
          value={f.horario} onChange={e => setF(p => ({ ...p, horario: e.target.value }))} />
      </div>
      <div className="col-span-2 sm:col-span-4 flex gap-2 mt-1">
        <Button size="sm" onClick={() => { if (!f.nome.trim()) { toast.error('Nome da disciplina é obrigatório'); return; } onSave(f); }} className="h-7 text-xs gap-1">
          <Check className="w-3 h-3" />Salvar
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="h-7 text-xs gap-1">
          <X className="w-3 h-3" />Cancelar
        </Button>
      </div>
    </div>
  );
};

// ─── Modules panel per turma ───────────────────────────────────────────────────
const ModulosPanel = ({ turmaId, onHonorarioChange }: { turmaId: string; onHonorarioChange: () => void }) => {
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingModule, setAddingModule] = useState(false);
  const [newModNome, setNewModNome] = useState('');
  const [editingModId, setEditingModId] = useState<string | null>(null);
  const [editModNome, setEditModNome] = useState('');
  const [addingDiscFor, setAddingDiscFor] = useState<string | null>(null);
  const [editingDisc, setEditingDisc] = useState<{ modId: string; disc: DiscFormState } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: mods } = await supabase
      .from('modulos')
      .select('*, disciplinas_turma(*)')
      .eq('turma_id', turmaId)
      .order('ordem');

    if (mods) {
      setModulos(mods.map(m => ({
        id: m.id, turmaId: m.turma_id, nome: m.nome, ordem: m.ordem,
        disciplinas: ((m.disciplinas_turma as DisciplinaTurma[]) || []).map(d => ({
          id: d.id, moduloId: m.id, numero: d.numero ?? 1,
          nome: d.nome, professor: d.professor ?? '',
          honorario: Number(d.honorario) || 0,
          horario: d.horario ?? '',
        })).sort((a, b) => a.numero - b.numero),
      })));
    }
    setLoading(false);
  }, [turmaId]);

  useEffect(() => { load(); }, [load]);

  const addModulo = async () => {
    if (!newModNome.trim()) { toast.error('Nome do módulo é obrigatório'); return; }
    const { error } = await supabase.from('modulos').insert({
      turma_id: turmaId, nome: newModNome.trim(), ordem: modulos.length,
    });
    if (!error) { toast.success('Módulo adicionado'); setNewModNome(''); setAddingModule(false); load(); }
    else toast.error('Erro ao adicionar módulo');
  };

  const updateModNome = async (id: string, nome: string) => {
    const { error } = await supabase.from('modulos').update({ nome }).eq('id', id);
    if (!error) { toast.success('Módulo atualizado'); setEditingModId(null); load(); }
    else toast.error('Erro ao atualizar');
  };

  const deleteModulo = async (id: string) => {
    const { error } = await supabase.from('modulos').delete().eq('id', id);
    if (!error) { toast.success('Módulo removido'); load(); onHonorarioChange(); }
    else toast.error('Erro ao remover');
  };

  const saveDisc = async (modId: string, f: DiscFormState) => {
    const payload = {
      modulo_id: modId, nome: f.nome, professor: f.professor,
      honorario: parseFloat(f.honorario) || 0, horario: f.horario,
      numero: f.id
        ? (modulos.find(m => m.id === modId)?.disciplinas.find(d => d.id === f.id)?.numero ?? 1)
        : (modulos.find(m => m.id === modId)?.disciplinas.length ?? 0) + 1,
    };
    if (f.id) {
      const { error } = await supabase.from('disciplinas_turma').update(payload).eq('id', f.id);
      if (!error) { toast.success('Disciplina atualizada'); setEditingDisc(null); load(); onHonorarioChange(); }
      else toast.error('Erro ao salvar');
    } else {
      const { error } = await supabase.from('disciplinas_turma').insert(payload);
      if (!error) { toast.success('Disciplina adicionada'); setAddingDiscFor(null); load(); onHonorarioChange(); }
      else toast.error('Erro ao salvar');
    }
  };

  const deleteDisc = async (id: string) => {
    const { error } = await supabase.from('disciplinas_turma').delete().eq('id', id);
    if (!error) { toast.success('Disciplina removida'); load(); onHonorarioChange(); }
    else toast.error('Erro ao remover');
  };

  if (loading) return <div className="flex justify-center py-4"><div className="loading-spinner" /></div>;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-primary" />Módulos e Disciplinas
        </h4>
        <Button variant="outline" size="sm" onClick={() => setAddingModule(true)} className="h-7 text-xs gap-1">
          <Plus className="w-3 h-3" />Módulo
        </Button>
      </div>

      {addingModule && (
        <div className="flex gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <Input className="form-input h-8 text-xs flex-1" placeholder="Nome do módulo (ex: Módulo I)"
            value={newModNome} onChange={e => setNewModNome(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addModulo(); if (e.key === 'Escape') { setAddingModule(false); setNewModNome(''); } }} />
          <Button size="sm" onClick={addModulo} className="h-8 text-xs gap-1"><Check className="w-3 h-3" />OK</Button>
          <Button size="sm" variant="outline" onClick={() => { setAddingModule(false); setNewModNome(''); }} className="h-8 text-xs"><X className="w-3 h-3" /></Button>
        </div>
      )}

      {modulos.length === 0 && !addingModule && (
        <p className="text-xs text-muted-foreground italic text-center py-2">Nenhum módulo ainda. Clique em "Módulo" para adicionar.</p>
      )}

      {modulos.map(mod => (
        <div key={mod.id} className="border border-border rounded-lg overflow-hidden">
          {/* Module header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/5">
            {editingModId === mod.id ? (
              <>
                <Input className="form-input h-7 text-xs flex-1" value={editModNome}
                  onChange={e => setEditModNome(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') updateModNome(mod.id, editModNome); if (e.key === 'Escape') setEditingModId(null); }} />
                <Button size="sm" onClick={() => updateModNome(mod.id, editModNome)} className="h-7 text-xs gap-1 px-2"><Check className="w-3 h-3" /></Button>
                <Button size="sm" variant="outline" onClick={() => setEditingModId(null)} className="h-7 text-xs px-2"><X className="w-3 h-3" /></Button>
              </>
            ) : (
              <>
                <span className="text-xs font-semibold text-primary flex-1">{mod.nome || 'Módulo sem nome'}</span>
                <button onClick={() => { setEditingModId(mod.id); setEditModNome(mod.nome); }} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                  <Edit2 className="w-3 h-3" />
                </button>
                <button onClick={() => deleteModulo(mod.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>

          {/* Disciplines */}
          <div className="p-3 space-y-2">
            {mod.disciplinas.map(disc => (
              editingDisc?.modId === mod.id && editingDisc?.disc.id === disc.id ? (
                <DiscForm key={disc.id}
                  disc={{ id: disc.id, nome: disc.nome, professor: disc.professor, honorario: String(disc.honorario || ''), horario: disc.horario }}
                  onSave={f => saveDisc(mod.id, f)}
                  onCancel={() => setEditingDisc(null)} />
              ) : (
                <div key={disc.id} className="flex items-center gap-3 p-2 rounded-lg bg-background border border-border/60 group hover:border-primary/30 transition-colors">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-primary">{disc.numero}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{disc.nome}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {disc.professor && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><User className="w-2.5 h-2.5" />{disc.professor}</span>}
                      {disc.horario && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{disc.horario}</span>}
                      {disc.honorario > 0 && <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1"><DollarSign className="w-2.5 h-2.5" />R$ {disc.honorario.toFixed(2).replace('.',',')}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditingDisc({ modId: mod.id, disc: { id: disc.id, nome: disc.nome, professor: disc.professor, honorario: String(disc.honorario || ''), horario: disc.horario } })}
                      className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><Edit2 className="w-3 h-3" /></button>
                    <button onClick={() => deleteDisc(disc.id)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              )
            ))}

            {/* Add discipline form */}
            {addingDiscFor === mod.id ? (
              <DiscForm
                disc={{ ...emptyDisc, numero: (mod.disciplinas.length + 1) } as DiscFormState}
                onSave={f => saveDisc(mod.id, f)}
                onCancel={() => setAddingDiscFor(null)} />
            ) : (
              mod.disciplinas.length < 2 && (
                <button onClick={() => setAddingDiscFor(mod.id)}
                  className="w-full text-xs text-primary/70 hover:text-primary border border-dashed border-primary/20 hover:border-primary/40 rounded-lg py-2 flex items-center justify-center gap-1 transition-all">
                  <Plus className="w-3 h-3" />Disciplina {mod.disciplinas.length + 1}
                </button>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Main TurmasTab ───────────────────────────────────────────────────────────
const TurmasTab = () => {
  const [turmas, setTurmas] = useState<TurmaWithModulos[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedTurma, setExpandedTurma] = useState<string | null>(null);
  const [honorarioKey, setHonorarioKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('classes').select('*').order('created_at', { ascending: true });
    if (data) setTurmas(data.map(r => ({
      id: r.id, nome: r.nome, turno: r.turno as Turno,
      disciplina: r.disciplina ?? '', professor: r.professor ?? '',
      diasSemana: r.dias_semana ?? '', nucleo: r.nucleo ?? '',
      honorario: Number(r.honorario) || 0,
      dataAula: r.data_aula ?? '',
      horario: r.horario ?? '',
      createdAt: r.created_at,
      modulos: [],
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.nome.trim()) { toast.error('Nome da turma é obrigatório'); return; }
    const payload = {
      nome: form.nome, turno: form.turno,
      dias_semana: form.diasSemana, nucleo: form.nucleo,
      data_aula: form.dataAula || null,
      horario: form.horario,
    };
    if (editingId) {
      const { error } = await supabase.from('classes').update(payload).eq('id', editingId);
      if (!error) toast.success('Turma atualizada'); else toast.error('Erro ao salvar');
    } else {
      const { error } = await supabase.from('classes').insert(payload);
      if (!error) toast.success('Turma criada'); else toast.error('Erro ao salvar');
    }
    setForm(emptyForm); setEditingId(null); setShowForm(false); load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (!error) { toast.success('Turma removida'); load(); } else toast.error('Erro ao remover');
  };

  const edit = (t: TurmaWithModulos) => {
    setForm({
      nome: t.nome, turno: t.turno,
      diasSemana: t.diasSemana, nucleo: t.nucleo,
      dataAula: t.dataAula ?? '', horario: t.horario ?? '',
    });
    setEditingId(t.id); setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{turmas.length} turma{turmas.length !== 1 ? 's' : ''} cadastrada{turmas.length !== 1 ? 's' : ''}</p>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }} className="btn-primary gap-2">
          {showForm ? <><X className="w-4 h-4" />Cancelar</> : <><Plus className="w-4 h-4" />Nova Turma</>}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="content-card p-6 border-l-4 border-l-primary">
          <h3 className="font-semibold text-foreground mb-4">{editingId ? 'Editar Turma' : 'Nova Turma'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="form-label">Nome da Turma *</label>
              <Input className="form-input" placeholder="Ex: Turma Média A" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Turno</label>
              <Select value={form.turno} onValueChange={v => setForm(p => ({ ...p, turno: v as Turno }))}>
                <SelectTrigger className="form-input"><SelectValue /></SelectTrigger>
                <SelectContent>{TURNOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="form-label">Data</label>
              <Input type="date" className="form-input" value={form.dataAula} onChange={e => setForm(p => ({ ...p, dataAula: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Dias da Semana</label>
              <Input className="form-input" placeholder="Ex: Sábado e Domingo" value={form.diasSemana} onChange={e => setForm(p => ({ ...p, diasSemana: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Horário</label>
              <Input className="form-input" placeholder="Ex: 19h às 21h30" value={form.horario} onChange={e => setForm(p => ({ ...p, horario: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Núcleo</label>
              <Input className="form-input" placeholder="Nome do núcleo" value={form.nucleo} onChange={e => setForm(p => ({ ...p, nucleo: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <Button onClick={save} className="btn-primary gap-2"><Check className="w-4 h-4" />Salvar</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="loading-spinner" /></div>
      ) : turmas.length === 0 ? (
        <div className="empty-state">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma turma cadastrada</p>
          <p className="text-sm mt-1">Clique em "Nova Turma" para começar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {turmas.map(t => (
            <div key={t.id} className="content-card overflow-hidden">
              {/* Card header */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-foreground leading-tight text-base">{t.nome}</h3>
                      {t.nucleo && <p className="text-xs text-muted-foreground mt-0.5">{t.nucleo}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={TURNO_COLOR[t.turno]}>{t.turno}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-muted-foreground">
                  {t.diasSemana && <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 flex-shrink-0" />{t.diasSemana}</span>}
                  {t.horario && <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 flex-shrink-0" />{t.horario}</span>}
                  {t.dataAula && <span className="flex items-center gap-1.5"><GraduationCap className="w-3 h-3 flex-shrink-0" />{new Date(t.dataAula + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                  <Button variant="outline" size="sm" onClick={() => edit(t)} className="h-8 text-xs gap-1.5">
                    <Edit2 className="w-3 h-3" />Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => del(t.id)} className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 gap-1.5">
                    <Trash2 className="w-3 h-3" />Excluir
                  </Button>
                  <button
                    onClick={() => setExpandedTurma(expandedTurma === t.id ? null : t.id)}
                    className="ml-auto flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                    <BookOpen className="w-3.5 h-3.5" />
                    {expandedTurma === t.id ? 'Ocultar módulos' : 'Ver módulos'}
                    {expandedTurma === t.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Modules panel */}
              {expandedTurma === t.id && (
                <div className="border-t border-border bg-muted/10 px-5 pb-5">
                  <ModulosPanel
                    key={`${t.id}-${honorarioKey}`}
                    turmaId={t.id}
                    onHonorarioChange={() => setHonorarioKey(k => k + 1)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TurmasTab;
