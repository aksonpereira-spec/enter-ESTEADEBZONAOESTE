import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Turma } from '@/types/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Trash2, Edit2, Building2, Clock, BookOpen, User, Check, X,
  ChevronDown, ChevronUp, GraduationCap, DollarSign, Calendar, Sun,
} from 'lucide-react';
import { toast } from 'sonner';

const TURNOS = ['Manhã', 'Tarde', 'Noite'];
const MODULO_FIXO = 'Médio em Teologia';

// ─── Discipline form ───────────────────────────────────────────────────────────
interface DiscFormState {
  id?: string;
  turno: string;
  dataAula: string;
  diaSemana: string;
  horario: string;
  nome: string;
  professor: string;
  honorario: string;
}

const emptyDisc: DiscFormState = {
  turno: 'Noite', dataAula: '', diaSemana: '', horario: '',
  nome: '', professor: '', honorario: '',
};

const DiscForm = ({ disc, numero, onSave, onCancel }: {
  disc: DiscFormState;
  numero: number;
  onSave: (d: DiscFormState) => void;
  onCancel: () => void;
}) => {
  const [f, setF] = useState(disc);
  const set = (k: keyof DiscFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="p-4 bg-primary/3 rounded-xl border border-primary/20 space-y-3">
      <p className="text-xs font-bold text-primary">Disciplina {numero}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Nome da disciplina */}
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="form-label text-xs">Nome da Disciplina *</label>
          <Input className="form-input h-8 text-xs" placeholder="Ex: Hermenêutica" value={f.nome} onChange={set('nome')} />
        </div>
        {/* Turno */}
        <div>
          <label className="form-label text-xs">Turno</label>
          <Select value={f.turno} onValueChange={v => setF(p => ({ ...p, turno: v }))}>
            <SelectTrigger className="form-input h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{TURNOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {/* Data */}
        <div>
          <label className="form-label text-xs">Data</label>
          <Input type="date" className="form-input h-8 text-xs" value={f.dataAula} onChange={set('dataAula')} />
        </div>
        {/* Dia da Semana */}
        <div>
          <label className="form-label text-xs">Dia da Semana</label>
          <Input className="form-input h-8 text-xs" placeholder="Ex: Sábado" value={f.diaSemana} onChange={set('diaSemana')} />
        </div>
        {/* Horário */}
        <div>
          <label className="form-label text-xs">Horário</label>
          <Input className="form-input h-8 text-xs" placeholder="Ex: 19h às 21h30" value={f.horario} onChange={set('horario')} />
        </div>
        {/* Professor */}
        <div>
          <label className="form-label text-xs">Professor</label>
          <Input className="form-input h-8 text-xs" placeholder="Nome do professor" value={f.professor} onChange={set('professor')} />
        </div>
        {/* Honorário */}
        <div>
          <label className="form-label text-xs">Honorário (R$)</label>
          <Input type="number" min="0" step="10" className="form-input h-8 text-xs" placeholder="0,00" value={f.honorario} onChange={set('honorario')} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => {
          if (!f.nome.trim()) { toast.error('Nome da disciplina é obrigatório'); return; }
          onSave(f);
        }} className="h-8 text-xs gap-1">
          <Check className="w-3 h-3" />Salvar
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="h-8 text-xs gap-1">
          <X className="w-3 h-3" />Cancelar
        </Button>
      </div>
    </div>
  );
};

// ─── Discipline card ────────────────────────────────────────────────────────────
interface DiscData extends DiscFormState { id: string; numero: number; }

const DiscCard = ({ disc, onEdit, onDelete }: {
  disc: DiscData;
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <div className="rounded-xl border border-border/60 bg-background p-3 group hover:border-primary/30 hover:shadow-sm transition-all">
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-primary">{disc.numero}</span>
        <p className="text-sm font-semibold text-foreground truncate">{disc.nome}</p>
      </div>
      <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><Edit2 className="w-3 h-3" /></button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3 h-3" /></button>
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {disc.turno && <span className="flex items-center gap-1"><Sun className="w-2.5 h-2.5 flex-shrink-0" />{disc.turno}</span>}
      {disc.diaSemana && <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5 flex-shrink-0" />{disc.diaSemana}</span>}
      {disc.horario && <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5 flex-shrink-0" />{disc.horario}</span>}
      {disc.dataAula && <span className="flex items-center gap-1 col-span-2 sm:col-span-1"><Calendar className="w-2.5 h-2.5 flex-shrink-0" />{new Date(disc.dataAula + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
      {disc.professor && <span className="flex items-center gap-1 col-span-2 sm:col-span-2"><User className="w-2.5 h-2.5 flex-shrink-0" />{disc.professor}</span>}
      {Number(disc.honorario) > 0 && <span className="flex items-center gap-1 font-semibold text-emerald-600"><DollarSign className="w-2.5 h-2.5 flex-shrink-0" />R$ {Number(disc.honorario).toFixed(2).replace('.',',')}</span>}
    </div>
  </div>
);

// ─── Disciplines panel (fixed module "Médio em Teologia") ─────────────────────
const DisciplinasPanel = ({ turmaId, onHonorarioChange }: { turmaId: string; onHonorarioChange: () => void }) => {
  const [moduloId, setModuloId] = useState<string | null>(null);
  const [disciplinas, setDisciplinas] = useState<DiscData[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingDisc, setAddingDisc] = useState(false);
  const [editingDiscId, setEditingDiscId] = useState<string | null>(null);

  const ensureModuloAndLoad = useCallback(async () => {
    setLoading(true);
    // Find or create the fixed module
    let { data: mod } = await supabase.from('modulos').select('id').eq('turma_id', turmaId).eq('nome', MODULO_FIXO).maybeSingle();
    if (!mod) {
      const { data: created } = await supabase.from('modulos').insert({ turma_id: turmaId, nome: MODULO_FIXO, ordem: 0 }).select().maybeSingle();
      mod = created;
    }
    if (!mod) { setLoading(false); return; }
    setModuloId(mod.id);

    const { data: discs } = await supabase
      .from('disciplinas_turma')
      .select('*')
      .eq('modulo_id', mod.id)
      .order('numero');

    setDisciplinas((discs || []).map(d => ({
      id: d.id, numero: d.numero ?? 1,
      turno: d.turno ?? 'Noite',
      dataAula: d.data_aula ?? '',
      diaSemana: d.dia_semana ?? '',
      horario: d.horario ?? '',
      nome: d.nome,
      professor: d.professor ?? '',
      honorario: String(d.honorario ?? ''),
    })));
    setLoading(false);
  }, [turmaId]);

  useEffect(() => { ensureModuloAndLoad(); }, [ensureModuloAndLoad]);

  const saveDisc = async (f: DiscFormState) => {
    if (!moduloId) return;
    const payload = {
      modulo_id: moduloId,
      nome: f.nome.trim(),
      professor: f.professor,
      honorario: parseFloat(f.honorario) || 0,
      horario: f.horario,
      turno: f.turno,
      data_aula: f.dataAula || null,
      dia_semana: f.diaSemana,
      numero: f.id
        ? (disciplinas.find(d => d.id === f.id)?.numero ?? 1)
        : disciplinas.length + 1,
    };

    if (f.id) {
      const { error } = await supabase.from('disciplinas_turma').update(payload).eq('id', f.id);
      if (!error) { toast.success('Disciplina atualizada'); setEditingDiscId(null); ensureModuloAndLoad(); onHonorarioChange(); }
      else toast.error('Erro ao salvar: ' + error.message);
    } else {
      const { error } = await supabase.from('disciplinas_turma').insert(payload);
      if (!error) { toast.success('Disciplina adicionada'); setAddingDisc(false); ensureModuloAndLoad(); onHonorarioChange(); }
      else toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const deleteDisc = async (id: string) => {
    const { error } = await supabase.from('disciplinas_turma').delete().eq('id', id);
    if (!error) { toast.success('Disciplina removida'); ensureModuloAndLoad(); onHonorarioChange(); }
    else toast.error('Erro ao remover');
  };

  if (loading) return <div className="flex justify-center py-6"><div className="loading-spinner" /></div>;

  return (
    <div className="space-y-4">
      {/* Module header (fixed, non-editable) */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-primary">{MODULO_FIXO}</span>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{disciplinas.length}/44 disciplinas</span>
        </div>
        {disciplinas.length < 44 && !addingDisc && (
          <Button variant="outline" size="sm" onClick={() => setAddingDisc(true)} className="h-7 text-xs gap-1">
            <Plus className="w-3 h-3" />Adicionar
          </Button>
        )}
      </div>

      {/* Add discipline form */}
      {addingDisc && (
        <DiscForm
          disc={emptyDisc}
          numero={disciplinas.length + 1}
          onSave={saveDisc}
          onCancel={() => setAddingDisc(false)} />
      )}

      {/* Disciplines list */}
      {disciplinas.length === 0 && !addingDisc && (
        <p className="text-xs text-muted-foreground italic text-center py-3">
          Nenhuma disciplina ainda. Clique em "Adicionar" para incluir a primeira.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {disciplinas.map(disc => (
          editingDiscId === disc.id ? (
            <div key={disc.id} className="sm:col-span-2">
              <DiscForm
                disc={disc}
                numero={disc.numero}
                onSave={saveDisc}
                onCancel={() => setEditingDiscId(null)} />
            </div>
          ) : (
            <DiscCard
              key={disc.id}
              disc={disc}
              onEdit={() => setEditingDiscId(disc.id)}
              onDelete={() => deleteDisc(disc.id)} />
          )
        ))}
      </div>
    </div>
  );
};

// ─── Main TurmasTab ────────────────────────────────────────────────────────────
const TurmasTab = () => {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [nucleo, setNucleo] = useState('');
  const [expandedTurma, setExpandedTurma] = useState<string | null>(null);
  const [honorarioKey, setHonorarioKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('classes').select('id, nome, nucleo, created_at').order('created_at', { ascending: true });
    if (data) setTurmas(data.map(r => ({
      id: r.id, nome: r.nome, turno: 'Noite' as const,
      disciplina: '', professor: '', diasSemana: '',
      nucleo: r.nucleo ?? '', honorario: 0, createdAt: r.created_at,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!nome.trim()) { toast.error('Nome da turma é obrigatório'); return; }
    if (editingId) {
      const { error } = await supabase.from('classes').update({ nome: nome.trim(), nucleo }).eq('id', editingId);
      if (!error) toast.success('Turma atualizada'); else toast.error('Erro ao salvar');
    } else {
      const { error } = await supabase.from('classes').insert({ nome: nome.trim(), nucleo, turno: 'Noite' });
      if (!error) toast.success('Turma criada'); else toast.error('Erro ao salvar');
    }
    setNome(''); setNucleo(''); setEditingId(null); setShowForm(false); load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (!error) { toast.success('Turma removida'); load(); } else toast.error('Erro ao remover');
  };

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{turmas.length} turma{turmas.length !== 1 ? 's' : ''} cadastrada{turmas.length !== 1 ? 's' : ''}</p>
        <Button onClick={() => { setShowForm(!showForm); setEditingId(null); setNome(''); setNucleo(''); }} className="btn-primary gap-2">
          {showForm ? <><X className="w-4 h-4" />Cancelar</> : <><Plus className="w-4 h-4" />Nova Turma</>}
        </Button>
      </div>

      {/* Form — only Nome and Núcleo */}
      {showForm && (
        <div className="content-card p-6 border-l-4 border-l-primary">
          <h3 className="font-semibold text-foreground mb-4">{editingId ? 'Editar Turma' : 'Nova Turma'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className="form-label">Nome da Turma *</label>
              <Input className="form-input" placeholder="Ex: Turma Média A" value={nome}
                onChange={e => setNome(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save(); }} />
            </div>
            <div>
              <label className="form-label">Núcleo</label>
              <Input className="form-input" placeholder="Ex: Zona Oeste" value={nucleo}
                onChange={e => setNucleo(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save(); }} />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <Button onClick={save} className="btn-primary gap-2"><Check className="w-4 h-4" />Salvar</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setNome(''); setNucleo(''); }}>Cancelar</Button>
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
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-foreground text-base leading-tight">{t.nome}</h3>
                      {t.nucleo && <p className="text-xs text-muted-foreground mt-0.5">{t.nucleo}</p>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                  <Button variant="outline" size="sm" onClick={() => {
                    setNome(t.nome); setNucleo(t.nucleo);
                    setEditingId(t.id); setShowForm(true);
                  }} className="h-8 text-xs gap-1.5">
                    <Edit2 className="w-3 h-3" />Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => del(t.id)}
                    className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5">
                    <Trash2 className="w-3 h-3" />Excluir
                  </Button>
                  <button
                    onClick={() => setExpandedTurma(expandedTurma === t.id ? null : t.id)}
                    className="ml-auto flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                    <BookOpen className="w-3.5 h-3.5" />
                    {expandedTurma === t.id ? 'Ocultar disciplinas' : 'Disciplinas'}
                    {expandedTurma === t.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Disciplines panel */}
              {expandedTurma === t.id && (
                <div className="border-t border-border bg-muted/10 px-5 pb-5 pt-4">
                  <DisciplinasPanel
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
