import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Aluno, Turma, Mensalidade, FormaPagamento } from '@/types/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard, CheckCircle2, Clock, DollarSign, TrendingUp,
  Filter, RefreshCw, User, X, History, Calendar, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';

const FORMAS: FormaPagamento[] = ['Dinheiro', 'Pix/Transferência', 'Cartão Crédito', 'Cartão Débito'];
const MONTHS_LABELS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const getMonthOptions = () => {
  const opts: { value: string; label: string }[] = [];
  // From January 2026 to December 2026, and add any past months from current year
  const now = new Date();
  const startYear = 2026;
  const startMonth = 1;
  const endYear = 2026;
  const endMonth = 12;

  // Also add past months from 3 months ago
  const pastStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const seen = new Set<string>();

  // Past months (last 3)
  for (let i = -3; i < 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!seen.has(val)) {
      seen.add(val);
      opts.push({ value: val, label: `${MONTHS_LABELS[d.getMonth()]} ${d.getFullYear()}` });
    }
  }

  // All months of 2026 (Jan to Dec)
  for (let m = startMonth; m <= endMonth; m++) {
    const val = `${startYear}-${String(m).padStart(2, '0')}`;
    if (!seen.has(val)) {
      seen.add(val);
      opts.push({ value: val, label: `${MONTHS_LABELS[m - 1]} ${startYear}` });
    }
  }

  // Sort chronologically
  opts.sort((a, b) => a.value.localeCompare(b.value));
  return opts;
};

interface PaymentHistory {
  id: string;
  mes: string;
  situacao: string;
  formaPagamento: string;
  valor: number;
  obs: string;
}

const MensalidadeTab = () => {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedTurma, setSelectedTurma] = useState('all');
  const monthOptions = getMonthOptions();

  // Individual student modal
  const [selectedAluno, setSelectedAluno] = useState<Aluno | null>(null);
  const [alunoHistory, setAlunoHistory] = useState<PaymentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load base data (alunos + turmas) — once, not on month change
  const loadBase = useCallback(async () => {
    const [aRes, tRes] = await Promise.all([
      supabase.from('alunos').select('*, classes(id, nome, turno)').eq('ativo', true).order('nome'),
      supabase.from('classes').select('*').order('nome'),
    ]);
    if (tRes.data) setTurmas(tRes.data.map(r => ({
      id: r.id, nome: r.nome, turno: r.turno, disciplina: r.disciplina ?? '',
      professor: r.professor ?? '', diasSemana: r.dias_semana ?? '', nucleo: r.nucleo ?? '',
      createdAt: r.created_at,
    })));
    if (aRes.data) {
      type AlunoRow = {
        id: string; nome: string; matricula: string | null; telefone: string | null;
        email: string | null; turma_id: string | null; ativo: boolean; created_at: string;
        classes: { id: string; nome: string; turno: string } | null;
      };
      setAlunos((aRes.data as AlunoRow[]).map(r => ({
        id: r.id, nome: r.nome, matricula: r.matricula ?? '', telefone: r.telefone ?? '',
        email: r.email ?? '', turmaId: r.turma_id, ativo: r.ativo, createdAt: r.created_at,
        turma: r.classes ? { id: r.classes.id, nome: r.classes.nome, turno: r.classes.turno, disciplina: '', professor: '', diasSemana: '', nucleo: '', createdAt: '' } : undefined,
      })));
    }
  }, []);

  // Load mensalidades for selected month only
  const loadMensalidades = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('mensalidades').select('*').eq('mes', selectedMonth);
    if (data) setMensalidades(data.map(r => ({
      id: r.id, alunoId: r.aluno_id, turmaId: r.turma_id, mes: r.mes,
      situacao: r.situacao as 'Pago' | 'Pendente',
      formaPagamento: (r.forma_pagamento ?? '') as FormaPagamento,
      valor: Number(r.valor) || 0, obs: r.obs ?? '',
    })));
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadMensalidades(); }, [loadMensalidades]);

  // Filter alunos by selected turma
  const filteredAlunos = selectedTurma === 'all' ? alunos : alunos.filter(a => a.turmaId === selectedTurma);

  const getMensalidade = (alunoId: string) => mensalidades.find(m => m.alunoId === alunoId);

  const updateMensalidade = async (aluno: Aluno, field: string, value: string | number) => {
    const existing = getMensalidade(aluno.id);

    if (existing) {
      const dbField = field === 'formaPagamento' ? 'forma_pagamento' : field;
      await supabase.from('mensalidades').update({ [dbField]: value }).eq('id', existing.id);
    } else {
      await supabase.from('mensalidades').insert({
        aluno_id: aluno.id,
        turma_id: aluno.turmaId,
        mes: selectedMonth,
        situacao: field === 'situacao' ? value : 'Pendente',
        forma_pagamento: field === 'formaPagamento' ? value : '',
        valor: field === 'valor' ? value : 0,
        obs: field === 'obs' ? value : '',
      });
    }

    // Update local state immediately
    setMensalidades(prev => {
      const dbField = field === 'formaPagamento' ? 'formaPagamento' : field;
      const idx = prev.findIndex(m => m.alunoId === aluno.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], [dbField]: value };
        return updated;
      } else {
        return [...prev, {
          id: 'temp-' + aluno.id, alunoId: aluno.id, turmaId: aluno.turmaId,
          mes: selectedMonth,
          situacao: field === 'situacao' ? value as 'Pago' | 'Pendente' : 'Pendente',
          formaPagamento: field === 'formaPagamento' ? value as FormaPagamento : '',
          valor: field === 'valor' ? Number(value) : 0,
          obs: field === 'obs' ? String(value) : '',
        }];
      }
    });
  };

  // Load individual student payment history
  const openAlunoHistory = async (aluno: Aluno) => {
    setSelectedAluno(aluno);
    setLoadingHistory(true);
    const { data } = await supabase
      .from('mensalidades')
      .select('*')
      .eq('aluno_id', aluno.id)
      .order('mes', { ascending: true });
    if (data) {
      setAlunoHistory(data.map(r => ({
        id: r.id,
        mes: r.mes,
        situacao: r.situacao,
        formaPagamento: r.forma_pagamento ?? '',
        valor: Number(r.valor) || 0,
        obs: r.obs ?? '',
      })));
    }
    setLoadingHistory(false);
  };

  const mesLabel = (mes: string) => {
    const [y, m] = mes.split('-');
    return `${MONTHS_LABELS[parseInt(m) - 1]} ${y}`;
  };

  // Summary
  const pagos = filteredAlunos.filter(a => getMensalidade(a.id)?.situacao === 'Pago');
  const pendentes = filteredAlunos.filter(a => getMensalidade(a.id)?.situacao !== 'Pago');
  const totalArrecadado = pagos.reduce((sum, a) => sum + (getMensalidade(a.id)?.valor || 0), 0);
  const byForma: Record<string, number> = {};
  pagos.forEach(a => {
    const m = getMensalidade(a.id);
    if (m?.formaPagamento) byForma[m.formaPagamento] = (byForma[m.formaPagamento] || 0) + m.valor;
  });

  const generateRelatorio = async (tipo: 'geral' | 'pagos' | 'pendentes') => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const mesLab = mesLabel(selectedMonth);
    const turmaLabel = selectedTurma === 'all' ? 'Todas as Turmas' : (turmas.find(t => t.id === selectedTurma)?.nome || '');
    const lista = tipo === 'geral' ? filteredAlunos : tipo === 'pagos' ? pagos : pendentes;

    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, 210, 35, 'F');
    try { doc.addImage('/logo-esteadeb.png', 'PNG', 10, 5, 40, 14, undefined, 'FAST'); } catch (_e) { /* no logo */ }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE MENSALIDADES', 105, 15, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`${mesLab} — ${turmaLabel}`, 105, 22, { align: 'center' });
    doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 105, 28, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    doc.setFillColor(248, 250, 252);
    doc.rect(10, 40, 190, 24, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(10, 40, 190, 24, 'S');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(`Total alunos: ${filteredAlunos.length}`, 20, 50);
    doc.text(`Pagos: ${pagos.length}`, 80, 50);
    doc.text(`Pendentes: ${pendentes.length}`, 130, 50);
    doc.text(`Arrecadado: R$ ${totalArrecadado.toFixed(2).replace('.', ',')}`, 20, 58);

    let y = 72;
    doc.setFillColor(30, 64, 175);
    doc.rect(10, y, 190, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('Nº', 13, y + 5.5);
    doc.text('Nome do Aluno', 25, y + 5.5);
    doc.text('Turma', 105, y + 5.5);
    doc.text('Forma Pgto.', 140, y + 5.5);
    doc.text('Valor', 170, y + 5.5);
    doc.text('Situação', 198, y + 5.5, { align: 'right' });
    y += 8;

    doc.setTextColor(0, 0, 0);
    lista.forEach((a, i) => {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.setFillColor(i % 2 === 0 ? 255 : 248);
      doc.rect(10, y, 190, 7.5, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      const m = getMensalidade(a.id);
      doc.text(String(i + 1), 13, y + 5);
      doc.text(a.nome.substring(0, 35), 25, y + 5);
      doc.text((a.turma?.nome || '—').substring(0, 20), 105, y + 5);
      doc.text((m?.formaPagamento || '—').substring(0, 18), 140, y + 5);
      doc.text(m?.valor ? `R$ ${m.valor.toFixed(2).replace('.', ',')}` : '—', 170, y + 5);
      const sit = m?.situacao || 'Pendente';
      doc.setTextColor(sit === 'Pago' ? 21 : 185, sit === 'Pago' ? 128 : 28, sit === 'Pago' ? 61 : 28);
      doc.setFont('helvetica', 'bold');
      doc.text(sit, 198, y + 5, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += 7.5;
    });

    doc.save(`Mensalidade_${tipo}_${mesLab.replace(' ', '_')}.pdf`);
    toast.success('Relatório gerado!');
  };

  // ─── Individual student modal ───────────────────────────────
  if (selectedAluno) {
    const totalPago = alunoHistory.filter(h => h.situacao === 'Pago').reduce((s, h) => s + h.valor, 0);
    const mesesPagos = alunoHistory.filter(h => h.situacao === 'Pago');
    return (
      <div className="space-y-5">
        <Button variant="outline" onClick={() => setSelectedAluno(null)} className="gap-2 btn-outline">
          <ArrowLeft className="w-4 h-4" />Voltar à Mensalidade
        </Button>

        <div className="content-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">{selectedAluno.nome.charAt(0)}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{selectedAluno.nome}</h2>
              {selectedAluno.matricula && <p className="text-sm text-muted-foreground">Matrícula: {selectedAluno.matricula}</p>}
              {selectedAluno.telefone && <p className="text-sm text-muted-foreground">{selectedAluno.telefone}</p>}
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="content-card p-4 bg-emerald-50 border-0">
              <p className="text-xs text-muted-foreground">Total Pago</p>
              <p className="text-xl font-bold text-emerald-600">R$ {totalPago.toFixed(2).replace('.', ',')}</p>
            </div>
            <div className="content-card p-4 bg-primary/5 border-0">
              <p className="text-xs text-muted-foreground">Meses Pagos</p>
              <p className="text-xl font-bold text-primary">{mesesPagos.length}</p>
            </div>
            <div className="content-card p-4 bg-muted/50 border-0">
              <p className="text-xs text-muted-foreground">Total Registros</p>
              <p className="text-xl font-bold text-foreground">{alunoHistory.length}</p>
            </div>
            <div className="content-card p-4 bg-muted/50 border-0">
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-xl font-bold text-red-600">{alunoHistory.filter(h => h.situacao === 'Pendente').length}</p>
            </div>
          </div>

          {/* History table */}
          {loadingHistory ? (
            <div className="flex justify-center py-8"><div className="loading-spinner" /></div>
          ) : alunoHistory.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhum registro de pagamento</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />Histórico de Pagamentos
              </h3>
              <table className="w-full">
                <thead>
                  <tr className="table-head">
                    <th className="table-th text-left">Mês</th>
                    <th className="table-th text-left">Situação</th>
                    <th className="table-th text-left hidden sm:table-cell">Forma de Pagamento</th>
                    <th className="table-th text-right">Valor</th>
                    <th className="table-th text-left hidden md:table-cell">Obs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {alunoHistory.map((h, i) => (
                    <tr key={h.id} className={`table-row ${h.situacao === 'Pago' ? 'bg-emerald-50/40' : ''}`}>
                      <td className="table-td">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium text-sm text-foreground">{mesLabel(h.mes)}</span>
                        </div>
                      </td>
                      <td className="table-td">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${h.situacao === 'Pago' ? 'badge-pago' : 'badge-pendente'}`}>
                          {h.situacao === 'Pago' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                          {h.situacao}
                        </span>
                      </td>
                      <td className="table-td hidden sm:table-cell text-sm text-muted-foreground">{h.formaPagamento || '—'}</td>
                      <td className="table-td text-right">
                        <span className={`font-semibold text-sm ${h.situacao === 'Pago' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {h.valor > 0 ? `R$ ${h.valor.toFixed(2).replace('.', ',')}` : '—'}
                        </span>
                      </td>
                      <td className="table-td hidden md:table-cell text-xs text-muted-foreground">{h.obs || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30">
                    <td colSpan={2} className="table-td font-bold text-sm text-foreground">Total Pago</td>
                    <td className="table-td hidden sm:table-cell" />
                    <td className="table-td text-right font-bold text-emerald-600 text-sm">
                      R$ {totalPago.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="table-td hidden md:table-cell" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Main view ─────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="content-card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filtros:</span>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="form-input w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-64">
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
            <Button variant="outline" size="sm" onClick={() => generateRelatorio('geral')} className="gap-1.5 h-9 text-xs">
              <CreditCard className="w-3.5 h-3.5" />PDF Geral
            </Button>
            <Button variant="outline" size="sm" onClick={() => generateRelatorio('pagos')} className="gap-1.5 h-9 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">PDF Pagos</Button>
            <Button variant="outline" size="sm" onClick={() => generateRelatorio('pendentes')} className="gap-1.5 h-9 text-xs text-red-700 border-red-200 hover:bg-red-50">PDF Pendentes</Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Alunos', value: filteredAlunos.length, icon: CreditCard, color: 'text-primary', bg: 'bg-primary/5' },
          { label: 'Pagos', value: pagos.length, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pendentes', value: pendentes.length, icon: Clock, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Arrecadado', value: `R$ ${totalArrecadado.toFixed(2).replace('.', ',')}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(s => (
          <div key={s.label} className={`content-card p-4 ${s.bg} border-0`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
              <s.icon className={`w-6 h-6 opacity-40 ${s.color}`} />
            </div>
          </div>
        ))}
      </div>

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
                <p className="text-primary font-bold">R$ {total.toFixed(2).replace('.', ',')}</p>
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
          <p className="font-medium">Nenhum aluno encontrado</p>
          <p className="text-sm mt-1">Cadastre alunos na aba "Cadastro de Alunos"</p>
        </div>
      ) : (
        <div className="content-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{mesLabel(selectedMonth)}</p>
            <p className="text-xs text-muted-foreground">{filteredAlunos.length} alunos — clique no nome para ver histórico</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-head">
                  <th className="table-th text-left">Aluno</th>
                  <th className="table-th text-left hidden md:table-cell">Turma</th>
                  <th className="table-th text-center">Situação</th>
                  <th className="table-th text-left hidden sm:table-cell">Forma de Pagamento</th>
                  <th className="table-th text-right hidden sm:table-cell">Valor</th>
                  <th className="table-th text-left hidden xl:table-cell">Obs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAlunos.map(a => {
                  const m = getMensalidade(a.id);
                  const isPago = m?.situacao === 'Pago';
                  return (
                    <tr key={a.id} className="table-row">
                      <td className="table-td">
                        <button
                          onClick={() => openAlunoHistory(a)}
                          className="flex items-center gap-2.5 group text-left w-full"
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold group-hover:ring-2 group-hover:ring-primary/30 transition-all ${isPago ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                            {a.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">{a.nome}</p>
                            {a.telefone && <p className="text-xs text-muted-foreground">{a.telefone}</p>}
                          </div>
                          <History className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                        </button>
                      </td>
                      <td className="table-td hidden md:table-cell text-sm text-muted-foreground">{a.turma?.nome || '—'}</td>
                      <td className="table-td text-center">
                        <Select
                          value={m?.situacao || 'Pendente'}
                          onValueChange={v => updateMensalidade(a, 'situacao', v)}
                        >
                          <SelectTrigger className={`h-8 text-xs font-semibold border-0 rounded-full px-3 w-28 mx-auto ${isPago ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pago">Pago</SelectItem>
                            <SelectItem value="Pendente">Pendente</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="table-td hidden sm:table-cell">
                        <Select
                          value={m?.formaPagamento || 'sem-forma'}
                          onValueChange={v => updateMensalidade(a, 'formaPagamento', v === 'sem-forma' ? '' : v)}
                        >
                          <SelectTrigger className="h-8 text-xs form-input w-40">
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sem-forma">— Nenhuma —</SelectItem>
                            {FORMAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="table-td text-right hidden sm:table-cell">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-8 text-xs text-right form-input w-24 ml-auto"
                          value={m?.valor || ''}
                          placeholder="0,00"
                          onChange={e => updateMensalidade(a, 'valor', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="table-td hidden xl:table-cell">
                        <Input
                          className="h-8 text-xs form-input"
                          placeholder="Observação..."
                          value={m?.obs || ''}
                          onChange={e => updateMensalidade(a, 'obs', e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            {pagos.length}/{filteredAlunos.length} pagos — R$ {totalArrecadado.toFixed(2).replace('.', ',')} arrecadados
          </div>
        </div>
      )}
    </div>
  );
};

export default MensalidadeTab;
