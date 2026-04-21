import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Aluno, Turma, Mensalidade, FormaPagamento } from '@/types/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard, CheckCircle2, Clock, DollarSign, TrendingUp,
  Filter, RefreshCw, History, Calendar, ArrowLeft, BookOpen, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const FORMAS: FormaPagamento[] = ['Dinheiro', 'Pix/Transferência', 'Cartão Crédito', 'Cartão Débito'];
const MONTHS_LABELS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const mesLabel = (mes: string) => {
  const [y, m] = mes.split('-');
  return `${MONTHS_LABELS[parseInt(m) - 1]} ${y}`;
};

const getMonthOptions = () => {
  const opts: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  const now = new Date();

  // Last 6 months
  for (let i = -6; i < 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!seen.has(val)) { seen.add(val); opts.push({ value: val, label: mesLabel(val) }); }
  }

  // All months 2026 Jan–Dec
  for (let m = 1; m <= 12; m++) {
    const val = `2026-${String(m).padStart(2, '0')}`;
    if (!seen.has(val)) { seen.add(val); opts.push({ value: val, label: mesLabel(val) }); }
  }

  opts.sort((a, b) => a.value.localeCompare(b.value));
  return opts;
};

// ─── Row component with LOCAL state — saves only on blur ─────────────────────
interface RowProps {
  aluno: Aluno;
  mensalidade: Mensalidade | undefined;
  selectedMonth: string;
  onSaved: () => void;
  onOpenHistory: (aluno: Aluno) => void;
}

const MensalidadeRow = ({ aluno, mensalidade, selectedMonth, onSaved, onOpenHistory }: RowProps) => {
  const [situacao, setSituacao] = useState<'Pago' | 'Pendente'>(mensalidade?.situacao || 'Pendente');
  const [forma, setForma] = useState<string>(mensalidade?.formaPagamento || 'sem-forma');
  const [valor, setValor] = useState<string>(mensalidade?.valor ? String(mensalidade.valor) : '');
  const [obs, setObs] = useState<string>(mensalidade?.obs || '');
  const [apostilas, setApostilas] = useState<'Sim' | 'Não'>(mensalidade?.apostilas || 'Não');
  const [qtd, setQtd] = useState<string>(mensalidade?.qtdApostilas ? String(mensalidade.qtdApostilas) : '');
  const mensalidadeIdRef = useRef(mensalidade?.id);

  // Sync when new month data loads (mensalidade changes)
  useEffect(() => {
    if (mensalidadeIdRef.current !== mensalidade?.id) {
      mensalidadeIdRef.current = mensalidade?.id;
      setSituacao(mensalidade?.situacao || 'Pendente');
      setForma(mensalidade?.formaPagamento || 'sem-forma');
      setValor(mensalidade?.valor ? String(mensalidade.valor) : '');
      setObs(mensalidade?.obs || '');
      setApostilas(mensalidade?.apostilas || 'Não');
      setQtd(mensalidade?.qtdApostilas ? String(mensalidade.qtdApostilas) : '');
    }
  }, [mensalidade]);

  const upsert = async (fields: Record<string, string | number | null>) => {
    if (mensalidade?.id && !mensalidade.id.startsWith('temp-')) {
      const { error } = await supabase.from('mensalidades').update(fields).eq('id', mensalidade.id);
      if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('mensalidades').insert({
        aluno_id: aluno.id,
        turma_id: aluno.turmaId,
        mes: selectedMonth,
        situacao: fields.situacao ?? situacao,
        forma_pagamento: fields.forma_pagamento ?? (forma === 'sem-forma' ? '' : forma),
        valor: fields.valor ?? (parseFloat(valor) || 0),
        obs: fields.obs ?? obs,
        apostilas: fields.apostilas ?? apostilas,
        qtd_apostilas: fields.qtd_apostilas ?? (parseInt(qtd) || 0),
      });
      if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
      onSaved();
    }
  };

  const handleSituacao = async (val: 'Pago' | 'Pendente') => {
    setSituacao(val);
    await upsert({ situacao: val });
    if (!mensalidade?.id) onSaved();
  };

  const handleForma = async (val: string) => {
    setForma(val);
    await upsert({ forma_pagamento: val === 'sem-forma' ? '' : val });
    if (!mensalidade?.id) onSaved();
  };

  const handleApostilas = async (val: 'Sim' | 'Não') => {
    setApostilas(val);
    if (val === 'Não') setQtd('');
    await upsert({ apostilas: val, qtd_apostilas: val === 'Não' ? 0 : (parseInt(qtd) || 0) });
    if (!mensalidade?.id) onSaved();
  };

  const isPago = situacao === 'Pago';

  return (
    <tr className="table-row">
      <td className="table-td">
        <button onClick={() => onOpenHistory(aluno)} className="flex items-center gap-2.5 group text-left">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold group-hover:ring-2 group-hover:ring-primary/30 transition-all ${isPago ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {aluno.nome.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">{aluno.nome}</p>
            {aluno.matricula && <p className="text-xs text-muted-foreground">{aluno.matricula}</p>}
          </div>
          <History className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
        </button>
      </td>
      <td className="table-td hidden md:table-cell text-sm text-muted-foreground">{aluno.turma?.nome || '—'}</td>

      {/* Situação */}
      <td className="table-td text-center">
        <Select value={situacao} onValueChange={handleSituacao}>
          <SelectTrigger className={`h-8 text-xs font-semibold border-0 rounded-full px-3 w-28 mx-auto ${isPago ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Pago">Pago</SelectItem>
            <SelectItem value="Pendente">Pendente</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Forma pagamento */}
      <td className="table-td hidden sm:table-cell">
        <Select value={forma} onValueChange={handleForma}>
          <SelectTrigger className="h-8 text-xs form-input w-40"><SelectValue placeholder="Forma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sem-forma">— Nenhuma —</SelectItem>
            {FORMAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>

      {/* Valor — local state, salva no blur */}
      <td className="table-td hidden sm:table-cell">
        <Input
          type="number"
          min="0"
          step="0.01"
          className="h-8 text-xs text-right form-input w-24 ml-auto"
          value={valor}
          placeholder="0,00"
          onChange={e => setValor(e.target.value)}
          onBlur={() => upsert({ valor: parseFloat(valor) || 0 })}
        />
      </td>

      {/* Apostilas */}
      <td className="table-td hidden lg:table-cell">
        <Select value={apostilas} onValueChange={handleApostilas}>
          <SelectTrigger className="h-8 text-xs form-input w-20"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Não">Não</SelectItem>
            <SelectItem value="Sim">Sim</SelectItem>
          </SelectContent>
        </Select>
      </td>

      {/* Qtd apostilas — local state, salva no blur */}
      <td className="table-td hidden lg:table-cell">
        <Input
          type="number"
          min="0"
          step="1"
          className="h-8 text-xs text-center form-input w-16"
          value={qtd}
          placeholder="0"
          disabled={apostilas === 'Não'}
          onChange={e => setQtd(e.target.value)}
          onBlur={() => upsert({ qtd_apostilas: parseInt(qtd) || 0, apostilas })}
        />
      </td>

      {/* Obs — local state, salva no blur */}
      <td className="table-td hidden xl:table-cell">
        <Input
          className="h-8 text-xs form-input"
          placeholder="Observação..."
          value={obs}
          onChange={e => setObs(e.target.value)}
          onBlur={() => upsert({ obs })}
        />
      </td>
    </tr>
  );
};

// ─── History types ────────────────────────────────────────────────────────────
interface PaymentHistory {
  id: string; mes: string; situacao: string; formaPagamento: string;
  valor: number; obs: string; apostilas: string; qtdApostilas: number;
}

// ─── Main component ───────────────────────────────────────────────────────────
const MensalidadeTab = () => {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedTurma, setSelectedTurma] = useState('all');
  const monthOptions = getMonthOptions();

  const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
  const [alunoHistory, setAlunoHistory] = useState<PaymentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load alunos + turmas ONCE — never changes with month
  const loadBase = useCallback(async () => {
    const [aRes, tRes] = await Promise.all([
      supabase.from('alunos').select('*, classes(id, nome, turno)').eq('ativo', true).order('nome'),
      supabase.from('classes').select('*').order('nome'),
    ]);
    if (aRes.error) { setLoadError(aRes.error.message); return; }
    if (tRes.data) setTurmas(tRes.data.map(r => ({
      id: r.id, nome: r.nome, turno: r.turno as 'Manhã' | 'Tarde' | 'Noite',
      disciplina: r.disciplina ?? '', professor: r.professor ?? '',
      diasSemana: r.dias_semana ?? '', nucleo: r.nucleo ?? '', createdAt: r.created_at,
    })));
    if (aRes.data) {
      type AR = { id: string; nome: string; matricula: string | null; telefone: string | null; email: string | null; turma_id: string | null; ativo: boolean; created_at: string; classes: { id: string; nome: string; turno: string } | null };
      setAlunos((aRes.data as AR[]).map(r => ({
        id: r.id, nome: r.nome, matricula: r.matricula ?? '', telefone: r.telefone ?? '',
        email: r.email ?? '', turmaId: r.turma_id, ativo: r.ativo, createdAt: r.created_at,
        turma: r.classes ? { id: r.classes.id, nome: r.classes.nome, turno: r.classes.turno as 'Manhã' | 'Tarde' | 'Noite', disciplina: '', professor: '', diasSemana: '', nucleo: '', createdAt: '' } : undefined,
      })));
    }
  }, []);

  // Load ONLY mensalidades for selected month
  const loadMensalidades = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase.from('mensalidades').select('*').eq('mes', selectedMonth);
    if (error) { setLoadError(error.message); setLoading(false); return; }
    if (data) setMensalidades(data.map(r => ({
      id: r.id, alunoId: r.aluno_id, turmaId: r.turma_id, mes: r.mes,
      situacao: (r.situacao || 'Pendente') as 'Pago' | 'Pendente',
      formaPagamento: (r.forma_pagamento ?? '') as FormaPagamento,
      valor: Number(r.valor) || 0, obs: r.obs ?? '',
      apostilas: (r.apostilas || 'Não') as 'Sim' | 'Não',
      qtdApostilas: Number(r.qtd_apostilas) || 0,
    })));
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadMensalidades(); }, [loadMensalidades]);

  const filteredAlunos = selectedTurma === 'all' ? alunos : alunos.filter(a => a.turmaId === selectedTurma);
  const getMensalidade = (alunoId: string) => mensalidades.find(m => m.alunoId === alunoId);

  // Summary stats
  const pagos = filteredAlunos.filter(a => getMensalidade(a.id)?.situacao === 'Pago');
  const totalArrecadado = pagos.reduce((s, a) => s + (getMensalidade(a.id)?.valor || 0), 0);
  const totalApostilas = mensalidades.reduce((s, m) => s + (m.qtdApostilas || 0), 0);
  const byForma: Record<string, number> = {};
  pagos.forEach(a => { const m = getMensalidade(a.id); if (m?.formaPagamento) byForma[m.formaPagamento] = (byForma[m.formaPagamento] || 0) + m.valor; });

  const openHistory = async (aluno: Aluno) => {
    setSelectedAluno(aluno);
    setLoadingHistory(true);
    const { data } = await supabase.from('mensalidades').select('*').eq('aluno_id', aluno.id).order('mes');
    if (data) setAlunoHistory(data.map(r => ({
      id: r.id, mes: r.mes, situacao: r.situacao,
      formaPagamento: r.forma_pagamento ?? '', valor: Number(r.valor) || 0,
      obs: r.obs ?? '', apostilas: r.apostilas ?? 'Não', qtdApostilas: Number(r.qtd_apostilas) || 0,
    })));
    setLoadingHistory(false);
  };

  const generatePDF = async (tipo: 'geral' | 'pagos' | 'pendentes') => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const mesLab = mesLabel(selectedMonth);
    const lista = tipo === 'geral' ? filteredAlunos : tipo === 'pagos' ? pagos : filteredAlunos.filter(a => getMensalidade(a.id)?.situacao !== 'Pago');
    const turmaLab = selectedTurma === 'all' ? 'Todas as Turmas' : (turmas.find(t => t.id === selectedTurma)?.nome || '');

    doc.setFillColor(30, 64, 175); doc.rect(0, 0, 297, 35, 'F');
    try { doc.addImage('/logo-esteadeb.png', 'PNG', 10, 5, 55, 16, undefined, 'FAST'); } catch (_e) { /* skip */ }
    doc.setTextColor(255,255,255); doc.setFontSize(15); doc.setFont('helvetica','bold');
    doc.text('RELATÓRIO DE MENSALIDADES', 148, 16, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text(`${mesLab} — ${turmaLab} — ${new Date().toLocaleDateString('pt-BR')}`, 148, 24, { align: 'center' });
    doc.text(`Pagos: ${pagos.length} | Pendentes: ${filteredAlunos.length - pagos.length} | Total: R$ ${totalArrecadado.toFixed(2).replace('.', ',')} | Apostilas: ${totalApostilas}`, 148, 30, { align: 'center' });

    let y = 43;
    doc.setTextColor(0,0,0); doc.setFillColor(30,64,175); doc.rect(10, y, 277, 8, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
    doc.text('Nº', 12, y+5.5); doc.text('Nome', 22, y+5.5); doc.text('Turma', 90, y+5.5);
    doc.text('Forma Pgto', 140, y+5.5); doc.text('Valor', 185, y+5.5);
    doc.text('Apostilas', 205, y+5.5); doc.text('Qtd', 228, y+5.5);
    doc.text('Situação', 275, y+5.5, { align: 'right' }); y += 8;

    doc.setTextColor(0,0,0);
    lista.forEach((a, i) => {
      if (y > 195) { doc.addPage(); y = 15; }
      doc.setFillColor(i % 2 === 0 ? 255 : 249); doc.rect(10, y, 277, 7.5, 'F');
      doc.setFont('helvetica','normal'); doc.setFontSize(8);
      const m = getMensalidade(a.id);
      doc.text(String(i+1), 12, y+5); doc.text(a.nome.substring(0,35), 22, y+5);
      doc.text((a.turma?.nome||'—').substring(0,25), 90, y+5);
      doc.text((m?.formaPagamento||'—').substring(0,18), 140, y+5);
      doc.text(m?.valor ? `R$ ${m.valor.toFixed(2).replace('.',',')}` : '—', 185, y+5);
      doc.text(m?.apostilas||'Não', 205, y+5);
      doc.text(m?.qtdApostilas ? String(m.qtdApostilas) : '—', 228, y+5);
      const sit = m?.situacao || 'Pendente';
      doc.setTextColor(sit==='Pago'?21:185, sit==='Pago'?128:28, sit==='Pago'?61:28);
      doc.setFont('helvetica','bold'); doc.text(sit, 275, y+5, { align: 'right' });
      doc.setTextColor(0,0,0); y += 7.5;
    });
    doc.save(`Mensalidade_${tipo}_${mesLab.replace(' ','_')}.pdf`);
    toast.success('Relatório gerado!');
  };

  // ─── Individual history view ──────────────────────────────────────────────
  if (selectedAluno) {
    const totalPago = alunoHistory.filter(h => h.situacao === 'Pago').reduce((s, h) => s + h.valor, 0);
    const qtdApostilasTot = alunoHistory.reduce((s, h) => s + h.qtdApostilas, 0);
    return (
      <div className="space-y-5">
        <Button variant="outline" onClick={() => setSelectedAluno(null)} className="gap-2">
          <ArrowLeft className="w-4 h-4" />Voltar
        </Button>
        <div className="content-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">{selectedAluno.nome.charAt(0)}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{selectedAluno.nome}</h2>
              {selectedAluno.matricula && <p className="text-sm text-muted-foreground">Matrícula: {selectedAluno.matricula}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { l: 'Total Pago', v: `R$ ${totalPago.toFixed(2).replace('.',',')}`, c: 'text-emerald-600', bg: 'bg-emerald-50' },
              { l: 'Meses Pagos', v: alunoHistory.filter(h=>h.situacao==='Pago').length, c: 'text-primary', bg: 'bg-primary/5' },
              { l: 'Pendentes', v: alunoHistory.filter(h=>h.situacao==='Pendente').length, c: 'text-red-600', bg: 'bg-red-50' },
              { l: 'Apostilas Total', v: qtdApostilasTot, c: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(s => (
              <div key={s.l} className={`content-card p-4 ${s.bg} border-0`}>
                <p className="text-xs text-muted-foreground">{s.l}</p>
                <p className={`text-xl font-bold mt-0.5 ${s.c}`}>{s.v}</p>
              </div>
            ))}
          </div>
          {loadingHistory ? (
            <div className="flex justify-center py-8"><div className="loading-spinner" /></div>
          ) : alunoHistory.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhum registro de pagamento</p>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />Histórico por Mês
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-head">
                      <th className="table-th text-left">Mês</th>
                      <th className="table-th text-left">Situação</th>
                      <th className="table-th text-left hidden sm:table-cell">Forma Pgto</th>
                      <th className="table-th text-right">Valor</th>
                      <th className="table-th text-center hidden md:table-cell">Apostilas</th>
                      <th className="table-th text-center hidden md:table-cell">Qtd</th>
                      <th className="table-th text-left hidden lg:table-cell">Obs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {alunoHistory.map(h => (
                      <tr key={h.id} className={`table-row ${h.situacao==='Pago' ? 'bg-emerald-50/40' : ''}`}>
                        <td className="table-td"><span className="font-medium text-sm text-foreground">{mesLabel(h.mes)}</span></td>
                        <td className="table-td">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${h.situacao==='Pago' ? 'badge-pago' : 'badge-pendente'}`}>
                            {h.situacao==='Pago' ? <CheckCircle2 className="w-3 h-3 mr-1"/> : <Clock className="w-3 h-3 mr-1"/>}{h.situacao}
                          </span>
                        </td>
                        <td className="table-td hidden sm:table-cell text-sm text-muted-foreground">{h.formaPagamento||'—'}</td>
                        <td className="table-td text-right">
                          <span className={`font-semibold text-sm ${h.situacao==='Pago' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                            {h.valor > 0 ? `R$ ${h.valor.toFixed(2).replace('.',',')}` : '—'}
                          </span>
                        </td>
                        <td className="table-td text-center hidden md:table-cell">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${h.apostilas==='Sim' ? 'bg-amber-100 text-amber-700' : 'text-muted-foreground'}`}>
                            <BookOpen className="w-3 h-3"/>{h.apostilas}
                          </span>
                        </td>
                        <td className="table-td text-center hidden md:table-cell text-sm text-muted-foreground">{h.qtdApostilas||'—'}</td>
                        <td className="table-td hidden lg:table-cell text-xs text-muted-foreground">{h.obs||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30">
                      <td colSpan={2} className="table-td font-bold text-sm text-foreground">Total</td>
                      <td className="table-td hidden sm:table-cell"/>
                      <td className="table-td text-right font-bold text-emerald-600 text-sm">R$ {totalPago.toFixed(2).replace('.',',')}</td>
                      <td className="table-td hidden md:table-cell"/>
                      <td className="table-td text-center hidden md:table-cell font-bold text-amber-600 text-sm">{qtdApostilasTot}</td>
                      <td className="table-td hidden lg:table-cell"/>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Main table ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="content-card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="form-input w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedTurma} onValueChange={setSelectedTurma}>
            <SelectTrigger className="form-input w-[180px]"><SelectValue placeholder="Todas as turmas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as turmas</SelectItem>
              {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadMensalidades} className="gap-1.5 h-9">
            <RefreshCw className="w-3.5 h-3.5" />Atualizar
          </Button>
          <div className="flex gap-2 ml-auto flex-wrap">
            <Button variant="outline" size="sm" onClick={() => generatePDF('geral')} className="gap-1.5 h-9 text-xs">
              <CreditCard className="w-3.5 h-3.5" />PDF Geral
            </Button>
            <Button variant="outline" size="sm" onClick={() => generatePDF('pagos')} className="gap-1.5 h-9 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
              PDF Pagos
            </Button>
            <Button variant="outline" size="sm" onClick={() => generatePDF('pendentes')} className="gap-1.5 h-9 text-xs text-red-700 border-red-200 hover:bg-red-50">
              PDF Pendentes
            </Button>
          </div>
        </div>
      </div>

      {/* Error */}
      {loadError && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{loadError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Total Alunos', v: filteredAlunos.length, icon: CreditCard, c: 'text-primary', bg: 'bg-primary/5' },
          { l: 'Pagos', v: pagos.length, icon: CheckCircle2, c: 'text-emerald-600', bg: 'bg-emerald-50' },
          { l: 'Pendentes', v: filteredAlunos.length - pagos.length, icon: Clock, c: 'text-red-600', bg: 'bg-red-50' },
          { l: 'Arrecadado', v: `R$ ${totalArrecadado.toFixed(2).replace('.',',')}`, icon: TrendingUp, c: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(s => (
          <div key={s.l} className={`content-card p-4 ${s.bg} border-0`}>
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-muted-foreground">{s.l}</p><p className={`text-xl font-bold mt-0.5 ${s.c}`}>{s.v}</p></div>
              <s.icon className={`w-6 h-6 opacity-40 ${s.c}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Apostilas summary */}
      {totalApostilas > 0 && (
        <div className="content-card p-3 flex items-center gap-3 bg-amber-50 border-amber-200">
          <BookOpen className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-bold">{totalApostilas}</span> apostila{totalApostilas !== 1 ? 's' : ''} registrada{totalApostilas !== 1 ? 's' : ''} em {mesLabel(selectedMonth)}
          </p>
        </div>
      )}

      {/* Formas de pagamento */}
      {Object.keys(byForma).length > 0 && (
        <div className="content-card p-4">
          <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />Formas de Pagamento — {mesLabel(selectedMonth)}
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byForma).map(([forma, total]) => (
              <div key={forma} className="px-3 py-2 rounded-lg bg-muted/60 border border-border text-xs">
                <p className="font-medium text-foreground">{forma}</p>
                <p className="text-primary font-bold">R$ {total.toFixed(2).replace('.',',')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="loading-spinner" /></div>
      ) : filteredAlunos.length === 0 ? (
        <div className="empty-state">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum aluno ativo encontrado</p>
          <p className="text-sm mt-1">Cadastre alunos na aba "Cadastro de Alunos"</p>
        </div>
      ) : (
        <div className="content-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{mesLabel(selectedMonth)}</p>
            <p className="text-xs text-muted-foreground">
              {filteredAlunos.length} alunos — <span className="text-primary cursor-pointer hover:underline" onClick={() => {}}>clique no nome para ver histórico completo</span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-head">
                  <th className="table-th text-left">
                    <button className="text-left w-full text-xs opacity-60 hover:opacity-100 transition-opacity" title="Clique no nome do aluno para ver histórico">
                      Aluno <History className="inline w-3 h-3 ml-1" />
                    </button>
                  </th>
                  <th className="table-th text-left hidden md:table-cell">Turma</th>
                  <th className="table-th text-center">Situação</th>
                  <th className="table-th text-left hidden sm:table-cell">Forma Pgto</th>
                  <th className="table-th text-right hidden sm:table-cell">Valor R$</th>
                  <th className="table-th text-center hidden lg:table-cell">Apostilas</th>
                  <th className="table-th text-center hidden lg:table-cell">Qtd</th>
                  <th className="table-th text-left hidden xl:table-cell">Obs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAlunos.map(a => (
                  <MensalidadeRow
                    key={`${a.id}-${selectedMonth}`}
                    aluno={a}
                    mensalidade={getMensalidade(a.id)}
                    selectedMonth={selectedMonth}
                    onSaved={loadMensalidades}
                    onOpenHistory={openHistory}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
            <span>{pagos.length}/{filteredAlunos.length} pagos — R$ {totalArrecadado.toFixed(2).replace('.',',')} arrecadados</span>
            {totalApostilas > 0 && <span className="text-amber-600 font-medium flex items-center gap-1"><BookOpen className="w-3 h-3"/>{totalApostilas} apostila{totalApostilas!==1?'s':''}</span>}
          </div>
        </div>
      )}

      {/* Note about clicking name for history */}
      <p className="text-xs text-muted-foreground text-center">
        Clique no nome de um aluno para ver o histórico completo de pagamentos de todos os meses
      </p>
    </div>
  );
};

export default MensalidadeTab;
