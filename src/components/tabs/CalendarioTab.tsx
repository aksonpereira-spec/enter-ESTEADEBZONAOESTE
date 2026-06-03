import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Calendar, User, BookOpen, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Evento {
  id: string;
  data_aula: string;
  professor: string;
  disciplina: string;
  obs: string;
  provas_disciplinas: string;
}

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function CalendarioTab() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    data_aula: '', professor: '', disciplina: '', obs: '', provas_disciplinas: '',
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('calendario_aulas').select('*').order('data_aula', { ascending: true });
    setEventos(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.data_aula || !form.professor || !form.disciplina) {
      toast.error('Preencha data, professor e disciplina');
      return;
    }
    const { error } = await supabase.from('calendario_aulas').insert({
      data_aula: form.data_aula,
      professor: form.professor,
      disciplina: form.disciplina,
      obs: form.obs,
      provas_disciplinas: form.provas_disciplinas,
    });
    if (error) { toast.error('Erro ao adicionar evento'); return; }
    toast.success('Evento adicionado');
    setForm({ data_aula: '', professor: '', disciplina: '', obs: '', provas_disciplinas: '' });
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('calendario_aulas').delete().eq('id', id);
    toast.success('Evento removido');
    load();
  };

  // Group by month
  const groups: Record<string, Evento[]> = {};
  eventos.forEach(e => {
    const d = new Date(e.data_aula + 'T00:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={() => setShowForm(s => !s)} className="btn-primary gap-2">
          <Plus className="w-4 h-4" />{showForm ? 'Cancelar' : 'Adicionar Aula'}
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="content-card p-5 border-2 border-primary/20">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />Nova Aula / Evento
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="form-label">Data da Aula</Label>
              <Input type="date" className="form-input mt-1" value={form.data_aula}
                onChange={e => setForm(p => ({ ...p, data_aula: e.target.value }))} />
            </div>
            <div>
              <Label className="form-label">Professor</Label>
              <Input className="form-input mt-1" placeholder="Nome do professor" value={form.professor}
                onChange={e => setForm(p => ({ ...p, professor: e.target.value }))} />
            </div>
            <div>
              <Label className="form-label">Disciplina</Label>
              <Input className="form-input mt-1" placeholder="Nome da disciplina" value={form.disciplina}
                onChange={e => setForm(p => ({ ...p, disciplina: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="form-label">Observação (opcional)</Label>
              <Input className="form-input mt-1" placeholder="Ex: Na sexta-feira antes das aulas, a partir das 18h as provas ficarão disponíveis."
                value={form.obs} onChange={e => setForm(p => ({ ...p, obs: e.target.value }))} />
            </div>
            <div>
              <Label className="form-label">Provas disponíveis (opcional)</Label>
              <Input className="form-input mt-1" placeholder="Ex: Cristologia e Bibliologia"
                value={form.provas_disciplinas} onChange={e => setForm(p => ({ ...p, provas_disciplinas: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleAdd} className="btn-primary gap-2">
              <Plus className="w-4 h-4" />Adicionar
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Calendar grouped by month */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="loading-spinner" /></div>
      ) : Object.keys(groups).length === 0 ? (
        <div className="empty-state py-16">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum evento cadastrado</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([key, evs]) => {
            const [year, month] = key.split('-').map(Number);
            const monthDate = new Date(year, month - 1, 1);
            const isPast = new Date(year, month, 0) < today; // last day of month < today
            return (
              <div key={key} className={isPast ? 'opacity-50' : ''}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className={`w-4 h-4 ${isPast ? 'text-muted-foreground' : 'text-primary'}`} />
                  <h3 className={`font-bold text-base uppercase tracking-wide ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {MESES_PT[monthDate.getMonth()]} {year}
                  </h3>
                  {isPast && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Passado</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {evs.map(ev => {
                    const d = new Date(ev.data_aula + 'T00:00:00');
                    const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    return (
                      <div key={ev.id} className="content-card p-4 relative group">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs text-muted-foreground font-mono font-medium">{dateStr}</span>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(ev.id)}
                            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <User className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          <span className="font-semibold text-foreground text-sm">{ev.professor}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <BookOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm text-muted-foreground">{ev.disciplina}</span>
                        </div>
                        {ev.obs && (
                          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                            <div className="flex items-start gap-1.5 mb-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                              <span className="text-xs font-bold text-amber-800 dark:text-amber-400">OBSERVAÇÃO:</span>
                            </div>
                            <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{ev.obs}</p>
                            {ev.provas_disciplinas && (
                              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 font-medium">• {ev.provas_disciplinas}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
