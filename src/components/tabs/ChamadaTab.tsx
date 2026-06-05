import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Aluno, Turma, AttendanceSession } from '@/types/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardCheck, Plus, Download, Trash2, Users, CheckCircle2, XCircle, History, Calendar, User, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const TURNOS = ['Manhã', 'Tarde', 'Noite'] as const;

const ChamadaTab = () => {
  const { coordenadorId } = useAuth();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'nova' | 'historico'>('nova');

  // Nova chamada
  const [selectedTurma, setSelectedTurma] = useState('');
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sessionTurno, setSessionTurno] = useState<'Manhã' | 'Tarde' | 'Noite'>('Noite');
  const [sessionProfessor, setSessionProfessor] = useState('');
  const [sessionDisciplina, setSessionDisciplina] = useState('');
  const [sessionObs, setSessionObs] = useState('');
  const [presencas, setPresencas] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [savedSession, setSavedSession] = useState<AttendanceSession | null>(null);

  // Histórico
  const [selectedHistSession, setSelectedHistSession] = useState<string>('');
  const [histAlunos, setHistAlunos] = useState<{ aluno: Aluno; presente: boolean }[]>([]);

  const loadBase = useCallback(async () => {
    if (!coordenadorId) return;
    setLoading(true);
    const [tRes, sRes] = await Promise.all([
      supabase.from('classes').select('*').eq('coordenador_id', coordenadorId).order('nome'),
      supabase.from('attendance_sessions').select('*').eq('coordenador_id', coordenadorId).order('data', { ascending: false }).limit(50),
    ]);
    if (tRes.data) setTurmas(tRes.data.map(r => ({ id: r.id, nome: r.nome, turno: r.turno as 'Manhã'|'Tarde'|'Noite', disciplina: r.disciplina ?? '', professor: r.professor ?? '', diasSemana: r.dias_semana ?? '', nucleo: r.nucleo ?? '', createdAt: r.created_at })));
    if (sRes.data) setSessions(sRes.data.map(r => ({ id: r.id, turmaId: r.turma_id, data: r.data, turno: r.turno as 'Manhã'|'Tarde'|'Noite', professor: r.professor ?? '', disciplina: r.disciplina ?? '', obs: r.obs ?? '', createdAt: r.created_at })));
    setLoading(false);
  }, [coordenadorId]);

  useEffect(() => { loadBase(); }, [loadBase]);

  // Load alunos when turma changes (nova chamada)
  useEffect(() => {
    if (!selectedTurma) { setAlunos([]); setPresencas({}); return; }
    supabase.from('alunos').select('*').eq('turma_id', selectedTurma).eq('ativo', true).order('nome').then(({ data }) => {
      if (data) {
        const list: Aluno[] = data.map(r => ({ id: r.id, nome: r.nome, matricula: r.matricula ?? '', telefone: r.telefone ?? '', email: r.email ?? '', turmaId: r.turma_id, ativo: r.ativo, createdAt: r.created_at }));
        setAlunos(list);
        const init: Record<string, boolean> = {};
        list.forEach(a => { init[a.id] = false; });
        setPresencas(init);
        setSavedSession(null);
      }
    });
    // Auto-fill turma info
    const t = turmas.find(t => t.id === selectedTurma);
    if (t) {
      if (t.professor) setSessionProfessor(t.professor);
      if (t.disciplina) setSessionDisciplina(t.disciplina);
      if (t.turno) setSessionTurno(t.turno);
    }
  }, [selectedTurma, turmas]);

  const toggleAll = (val: boolean) => {
    const next: Record<string, boolean> = {};
    alunos.forEach(a => { next[a.id] = val; });
    setPresencas(next);
  };

  const salvarChamada = async () => {
    if (!selectedTurma) { toast.error('Selecione uma turma'); return; }
    if (!sessionDate) { toast.error('Informe a data da aula'); return; }
    if (!coordenadorId) return;
    setSaving(true);
    const { data: sess, error: sessErr } = await supabase.from('attendance_sessions').insert({
      turma_id: selectedTurma,
      data: sessionDate,
      turno: sessionTurno,
      professor: sessionProfessor,
      disciplina: sessionDisciplina,
      obs: sessionObs,
      coordenador_id: coordenadorId,
    }).select().single();
    if (sessErr || !sess) { toast.error('Erro ao salvar sessão'); setSaving(false); return; }

    const records = alunos.map(a => ({ session_id: sess.id, aluno_id: a.id, presente: presencas[a.id] ?? false }));
    if (records.length > 0) {
      const { error } = await supabase.from('attendance_records').insert(records);
      if (error) { toast.error('Erro ao salvar presenças'); setSaving(false); return; }
    }

    toast.success('Chamada salva com sucesso!');
    const turma = turmas.find(t => t.id === selectedTurma);
    setSavedSession({ id: sess.id, turmaId: selectedTurma, turma, data: sessionDate, turno: sessionTurno, professor: sessionProfessor, disciplina: sessionDisciplina, obs: sessionObs, createdAt: sess.created_at });
    loadBase();
    setSaving(false);
  };

  const exportPDF = async (session: AttendanceSession | null, alunosList: Aluno[], presencaMap: Record<string, boolean>, titulo = 'Lista de Presença') => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const turma = turmas.find(t => t.id === session?.turmaId);
    const dateStr = session?.data ? new Date(session.data + 'T12:00:00').toLocaleDateString('pt-BR') : '';
    const dayOfWeek = session?.data ? ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][new Date(session.data + 'T12:00:00').getDay()] : '';

    // ── Header ─────────────────────────────────────────
    try { doc.addImage('/logo-esteadeb.png', 'PNG', 12, 8, 45, 16, undefined, 'FAST'); } catch (_e) { /* logo not available */ }
    doc.setTextColor(0);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('ESCOLA TEOLÓGICA DAS ASSEMBLEIAS DE', 105, 14, { align: 'center' });
    doc.text('DEUS NO BRASIL (ESTEADEB)', 105, 20, { align: 'center' });
    doc.setDrawColor(200);
    doc.line(12, 28, 200, 28);

    // ── Info ────────────────────────────────────────────
    let y = 34;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`NÚCLEO: ${turma?.nucleo || '___________________________'}`, 12, y);
    y += 8;
    doc.text(`DATA: ${dateStr || '__/__/______'}   DIA: ( ${dayOfWeek === 'Sábado' ? 'X' : ' '} ) SÁBADO   ( ${dayOfWeek === 'Domingo' ? 'X' : ' '} ) DOMINGO   TURNO: ${session?.turno || ''}`, 12, y);
    y += 8;
    doc.text(`PROFESSOR(A): ${session?.professor || '___________________________'}`, 12, y);
    if (session?.disciplina) {
      y += 7;
      doc.text(`DISCIPLINA: ${session.disciplina}`, 12, y);
    }

    // ── Title ───────────────────────────────────────────
    y += 10;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('LISTA DE PRESENÇA', 105, y, { align: 'center' });
    y += 8;

    // ── Table ───────────────────────────────────────────
    const colWidths = [12, 90, 42, 44]; // Nº, Nome, Telefone, Assinatura
    const colX = [12, 24, 114, 156];
    const rowH = 9;
    const tableW = 188;

    // Header row
    doc.setFillColor(210, 220, 240);
    doc.rect(12, y, tableW, rowH, 'F');
    doc.setDrawColor(150);
    doc.setLineWidth(0.3);
    doc.rect(12, y, tableW, rowH, 'S');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text('Nº', colX[0] + 1, y + 6);
    doc.text('NOME DO ALUNO', colX[1] + 1, y + 6);
    doc.text('TELEFONE', colX[2] + 1, y + 6);
    doc.text('ASSINATURA', colX[3] + 1, y + 6);
    // vertical lines
    colX.forEach((x, i) => { if (i > 0) doc.line(x, y, x, y + rowH); });
    y += rowH;

    // Data rows (show all alunos, not just present)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const rows = alunosList.length > 0 ? alunosList : Array.from({ length: 28 }, (_, i) => ({ id: `empty-${i}`, nome: '', telefone: '', matricula: '', email: '', turmaId: null, ativo: true, createdAt: '' }));

    rows.forEach((a, idx) => {
      if (y + rowH > 280) {
        doc.addPage();
        y = 15;
      }
      doc.setFillColor(idx % 2 === 0 ? 255 : 250);
      doc.rect(12, y, tableW, rowH, 'F');
      doc.setDrawColor(200);
      doc.rect(12, y, tableW, rowH, 'S');
      colX.forEach((x, i) => { if (i > 0) doc.line(x, y, x, y + rowH); });
      doc.setTextColor(0);
      doc.text(String(idx + 1).padStart(2, '0'), colX[0] + 1, y + 6);
      doc.text(a.nome.substring(0, 40), colX[1] + 1, y + 6);
      doc.text((a as Aluno).telefone?.substring(0, 18) || '', colX[2] + 1, y + 6);
      // signature line or checkmark
      if (a.id.startsWith('empty-')) {
        // just space
      }
      y += rowH;
    });

    // Observations
    if (y + 30 < 280) {
      y += 8;
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('OBSERVAÇÕES:', 12, y);
      y += 6;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      for (let i = 0; i < 3; i++) {
        doc.line(12, y, 200, y);
        y += 7;
      }
    }

    // Footer
    doc.setFontSize(7); doc.setTextColor(150);
    doc.text('Escola Teológica das Assembleias de Deus no Brasil — ESTEADEB', 105, 292, { align: 'center' });

    const fileName = `Lista_Presenca_${turma?.nome || 'Turma'}_${dateStr?.replace(/\//g, '-') || 'data'}.pdf`;
    doc.save(fileName);
    toast.success('Lista de presença exportada!');
  };

  // Load historico session
  const loadHistSession = async (sessionId: string) => {
    const { data } = await supabase
      .from('attendance_records')
      .select('*, alunos(id, nome, telefone, matricula, email, turma_id, ativo, created_at)')
      .eq('session_id', sessionId);
    if (data) {
      setHistAlunos(data.map((r: Record<string, Record<string, unknown>>) => ({
        aluno: { id: r.alunos.id, nome: r.alunos.nome, telefone: r.alunos.telefone ?? '', matricula: r.alunos.matricula ?? '', email: r.alunos.email ?? '', turmaId: r.alunos.turma_id, ativo: r.alunos.ativo, createdAt: r.alunos.created_at },
        presente: r.presente,
      })));
    }
  };

  const deleteSession = async (id: string) => {
    await supabase.from('attendance_sessions').delete().eq('id', id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (selectedHistSession === id) { setSelectedHistSession(''); setHistAlunos([]); }
    toast.success('Chamada excluída');
  };

  const presentes = alunos.filter(a => presencas[a.id]).length;
  const ausentes = alunos.length - presentes;

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button onClick={() => setMode('nova')} className={`gap-2 ${mode === 'nova' ? 'btn-primary' : 'btn-outline'}`}>
          <Plus className="w-4 h-4" />Nova Chamada
        </Button>
        <Button onClick={() => setMode('historico')} className={`gap-2 ${mode === 'historico' ? 'btn-primary' : 'btn-outline'}`}>
          <History className="w-4 h-4" />Histórico
        </Button>
      </div>

      {/* ─── NOVA CHAMADA ─────────────────────────────────────── */}
      {mode === 'nova' && (
        <div className="space-y-5">
          {/* Setup */}
          <div className="content-card p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" />Configurar Chamada</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Turma *</label>
                <Select value={selectedTurma} onValueChange={setSelectedTurma}>
                  <SelectTrigger className="form-input"><SelectValue placeholder="Selecionar turma" /></SelectTrigger>
                  <SelectContent>
                    {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome} — {t.turno}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="form-label">Data da Aula *</label>
                <Input type="date" className="form-input" value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Turno</label>
                <Select value={sessionTurno} onValueChange={v => setSessionTurno(v as typeof sessionTurno)}>
                  <SelectTrigger className="form-input"><SelectValue /></SelectTrigger>
                  <SelectContent>{TURNOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="form-label">Professor(a)</label>
                <Input className="form-input" placeholder="Nome do professor" value={sessionProfessor} onChange={e => setSessionProfessor(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Disciplina</label>
                <Input className="form-input" placeholder="Ex: Hermenêutica" value={sessionDisciplina} onChange={e => setSessionDisciplina(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Observações</label>
                <Input className="form-input" placeholder="Observações da aula..." value={sessionObs} onChange={e => setSessionObs(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Attendance list */}
          {alunos.length > 0 ? (
            <div className="content-card overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <ClipboardCheck className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Lista de Chamada</h3>
                    <p className="text-xs text-muted-foreground">{alunos.length} aluno{alunos.length !== 1 ? 's' : ''} — {presentes} presente{presentes !== 1 ? 's' : ''}, {ausentes} ausente{ausentes !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleAll(true)} className="h-8 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"><CheckCircle2 className="w-3.5 h-3.5" />Todos</Button>
                  <Button variant="outline" size="sm" onClick={() => toggleAll(false)} className="h-8 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"><XCircle className="w-3.5 h-3.5" />Nenhum</Button>
                </div>
              </div>

              {/* Students */}
              <div className="divide-y divide-border">
                {alunos.map((a, i) => {
                  const presente = presencas[a.id] ?? false;
                  return (
                    <div
                      key={a.id}
                      onClick={() => setPresencas(prev => ({ ...prev, [a.id]: !prev[a.id] }))}
                      className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-all duration-150 ${presente ? 'bg-emerald-50/70 hover:bg-emerald-50' : 'hover:bg-muted/40'}`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${presente ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40'}`}>
                        {presente && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-6 flex-shrink-0">{String(i+1).padStart(2,'0')}</span>
                          <p className="font-medium text-foreground text-sm truncate">{a.nome}</p>
                        </div>
                        {a.telefone && <p className="text-xs text-muted-foreground ml-8">{a.telefone}</p>}
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${presente ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {presente ? 'Presente' : 'Ausente'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 p-4 border-t border-border bg-muted/20">
                <Button onClick={salvarChamada} disabled={saving} className="btn-primary gap-2 flex-1">
                  {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />Salvando...</> : <><ClipboardCheck className="w-4 h-4" />Salvar Chamada</>}
                </Button>
                {savedSession && (
                  <Button
                    variant="outline"
                    onClick={() => exportPDF(savedSession, alunos, presencas)}
                    className="gap-2 flex-1"
                  >
                    <Download className="w-4 h-4" />Exportar Lista PDF
                  </Button>
                )}
              </div>
            </div>
          ) : selectedTurma ? (
            <div className="empty-state">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum aluno nesta turma</p>
              <p className="text-sm mt-1">Cadastre alunos e vincule à turma</p>
            </div>
          ) : (
            <div className="empty-state">
              <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Selecione uma turma para iniciar a chamada</p>
            </div>
          )}
        </div>
      )}

      {/* ─── HISTÓRICO ─────────────────────────────────────────── */}
      {mode === 'historico' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-16"><div className="loading-spinner" /></div>
          ) : sessions.length === 0 ? (
            <div className="empty-state">
              <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma chamada registrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sessions list */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground mb-3">Chamadas Registradas</h3>
                {sessions.map(s => {
                  const turma = turmas.find(t => t.id === s.turmaId);
                  const isSelected = selectedHistSession === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => { setSelectedHistSession(s.id); loadHistSession(s.id); }}
                      className={`content-card p-4 cursor-pointer transition-all ${isSelected ? 'border-primary/50 bg-primary/5' : 'hover:border-border/80'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-primary/10"><Calendar className="w-3.5 h-3.5 text-primary" /></div>
                          <div>
                            <p className="font-medium text-foreground text-sm">{turma?.nome || 'Turma não encontrada'}</p>
                            <p className="text-xs text-muted-foreground">{new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR')} — {s.turno}</p>
                            {s.professor && <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" />{s.professor}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost" size="sm"
                            onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Session detail */}
              <div>
                {histAlunos.length > 0 && selectedHistSession ? (() => {
                  const sess = sessions.find(s => s.id === selectedHistSession)!;
                  const presMap: Record<string, boolean> = {};
                  histAlunos.forEach(({ aluno, presente }) => { presMap[aluno.id] = presente; });
                  const presentesH = histAlunos.filter(x => x.presente).length;
                  return (
                    <div className="content-card overflow-hidden">
                      <div className="p-4 border-b border-border flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground text-sm">{new Date(sess.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
                          <p className="text-xs text-muted-foreground">{presentesH}/{histAlunos.length} presentes</p>
                        </div>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => exportPDF(sess, histAlunos.map(x => x.aluno), presMap)}
                          className="gap-1.5 h-8 text-xs"
                        >
                          <Download className="w-3.5 h-3.5" />PDF
                        </Button>
                      </div>
                      <div className="divide-y divide-border max-h-96 overflow-y-auto">
                        {histAlunos.map(({ aluno, presente }, i) => (
                          <div key={aluno.id} className={`flex items-center gap-3 px-4 py-2.5 ${presente ? 'bg-emerald-50/50' : ''}`}>
                            <span className="text-xs font-bold text-muted-foreground w-5">{i+1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{aluno.nome}</p>
                              {aluno.telefone && <p className="text-xs text-muted-foreground">{aluno.telefone}</p>}
                            </div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${presente ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                              {presente ? 'P' : 'A'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })() : (
                  <div className="empty-state h-full min-h-[200px] flex flex-col items-center justify-center">
                    <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Selecione uma chamada</p>
                    <p className="text-xs mt-1">para ver os detalhes</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChamadaTab;
