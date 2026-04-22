import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Turma, Turno } from '@/types/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit2, Building2, Clock, BookOpen, User, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const TURNOS: Turno[] = ['Manhã', 'Tarde', 'Noite'];
const DIAS_OPTIONS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const TURNO_COLOR: Record<Turno, string> = {
  'Manhã': 'badge-manha',
  'Tarde': 'badge-tarde',
  'Noite': 'badge-noite',
};

const emptyForm = { nome: '', turno: 'Noite' as Turno, disciplina: '', professor: '', diasSemana: '', nucleo: '', honorario: '' };

const TurmasTab = () => {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('classes').select('*').order('created_at', { ascending: true });
    if (data) setTurmas(data.map(r => ({
      id: r.id, nome: r.nome, turno: r.turno as Turno,
      disciplina: r.disciplina ?? '', professor: r.professor ?? '',
      diasSemana: r.dias_semana ?? '', nucleo: r.nucleo ?? '',
      honorario: Number(r.honorario) || 0, createdAt: r.created_at,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.nome.trim()) { toast.error('Nome da turma é obrigatório'); return; }
    const payload = { nome: form.nome, turno: form.turno, disciplina: form.disciplina, professor: form.professor, dias_semana: form.diasSemana, nucleo: form.nucleo, honorario: parseFloat(form.honorario) || 0 };
    if (editingId) {
      const { error } = await supabase.from('classes').update(payload).eq('id', editingId);
      if (!error) { toast.success('Turma atualizada'); } else { toast.error('Erro ao salvar'); }
    } else {
      const { error } = await supabase.from('classes').insert(payload);
      if (!error) { toast.success('Turma criada'); } else { toast.error('Erro ao salvar'); }
    }
    setForm(emptyForm); setEditingId(null); setShowForm(false); load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (!error) { toast.success('Turma removida'); load(); } else { toast.error('Erro ao remover'); }
  };

  const edit = (t: Turma) => {
    setForm({ nome: t.nome, turno: t.turno, disciplina: t.disciplina, professor: t.professor, diasSemana: t.diasSemana, nucleo: t.nucleo, honorario: t.honorario ? String(t.honorario) : '' });
    setEditingId(t.id); setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">{turmas.length} turma{turmas.length !== 1 ? 's' : ''} cadastrada{turmas.length !== 1 ? 's' : ''}</p>
        </div>
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
              <Input className="form-input" placeholder="Ex: Teologia I" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Turno</label>
              <Select value={form.turno} onValueChange={v => setForm(p => ({ ...p, turno: v as Turno }))}>
                <SelectTrigger className="form-input"><SelectValue /></SelectTrigger>
                <SelectContent>{TURNOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="form-label">Dias da Semana</label>
              <Input className="form-input" placeholder="Ex: Sábado, Domingo" value={form.diasSemana} onChange={e => setForm(p => ({ ...p, diasSemana: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Disciplina</label>
              <Input className="form-input" placeholder="Ex: Hermenêutica" value={form.disciplina} onChange={e => setForm(p => ({ ...p, disciplina: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Professor</label>
              <Input className="form-input" placeholder="Nome do professor" value={form.professor} onChange={e => setForm(p => ({ ...p, professor: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Núcleo</label>
              <Input className="form-input" placeholder="Nome do núcleo" value={form.nucleo} onChange={e => setForm(p => ({ ...p, nucleo: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Honorário do Professor (R$)</label>
              <Input type="number" min="0" step="10" className="form-input" placeholder="0,00" value={form.honorario} onChange={e => setForm(p => ({ ...p, honorario: e.target.value }))} />
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {turmas.map(t => (
            <div key={t.id} className="content-card p-5 hover:shadow-md transition-all duration-200 group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground leading-tight">{t.nome}</h3>
                    {t.nucleo && <p className="text-xs text-muted-foreground mt-0.5">{t.nucleo}</p>}
                  </div>
                </div>
                <span className={TURNO_COLOR[t.turno]}>{t.turno}</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {t.disciplina && <div className="flex items-center gap-1.5"><BookOpen className="w-3 h-3 flex-shrink-0" /><span>{t.disciplina}</span></div>}
                {t.professor && <div className="flex items-center gap-1.5"><User className="w-3 h-3 flex-shrink-0" /><span>{t.professor}</span></div>}
                {t.diasSemana && <div className="flex items-center gap-1.5"><Clock className="w-3 h-3 flex-shrink-0" /><span>{t.diasSemana}</span></div>}
                {t.honorario > 0 && <div className="flex items-center gap-1.5 text-emerald-600 font-medium"><span>Honorário: R$ {t.honorario.toFixed(2).replace('.',',')}</span></div>}
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="outline" size="sm" onClick={() => edit(t)} className="flex-1 h-8 text-xs gap-1"><Edit2 className="w-3 h-3" />Editar</Button>
                <Button variant="outline" size="sm" onClick={() => del(t.id)} className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TurmasTab;
