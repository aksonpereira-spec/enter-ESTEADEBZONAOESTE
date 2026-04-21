import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Aluno, Turma, Mensalidade, FormaPagamento } from '@/types/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, CheckCircle2, Clock, DollarSign, TrendingUp, Filter, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const FORMAS: FormaPagamento[] = ['Dinheiro', 'Pix/Transferência', 'Cartão Crédito', 'Cartão Débito'];
const MONTHS_LABELS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const getMonthOptions = () => {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -3; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    opts.push({ value: val, label: `${MONTHS_LABELS[d.getMonth()]} ${d.getFullYear()}` });
  }
  return opts;
};

const MensalidadeTab = () => {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedTurma, setSelectedTurma] = useState('all');
  const monthOptions = getMonthOptions();

  const load = useCallback(async () => {
    setLoading(true);
    const [aRes, tRes, mRes] = await Promise.all([
      supabase.from('alunos').select('*, classes(id, nome, turno)').eq('ativo', true).order('nome'),
      supabase.from('classes').select('*').order('nome'),
      supabase.from('mensalidades').select('*').eq('mes', selectedMonth),
    ]);
    if (tRes.data) setTurmas(tRes.data.map(r => ({ id: r.id, nome: r.nome, turno: r.turno, disciplina: r.disciplina ?? '', professor: r.professor ?? '', diasSemana: r.dias_semana ?? '', nucleo: r.nucleo ?? '', createdAt: r.created_at })));
    if (aRes.data) setAlunos(aRes.data.map((r: Record<string, unknown>) => ({
      id: r.id, nome: r.nome, matricula: r.matricula ?? '', telefone: r.telefone ?? '',
      email: r.email ?? '', turmaId: r.turma_id, ativo: r.ativo,
      createdAt: r.created_at,
      turma: r.classes ? { id: r.classes.id, nome: r.classes.nome, turno: r.classes.turno, disciplina: '', professor: '', diasSemana: '', nucleo: '', createdAt: '' } : undefined,
    })));
    if (mRes.data) setMensalidades(mRes.data.map(r => ({
      id: r.id, alunoId: r.aluno_id, turmaId: r.turma_id, mes: r.mes,
      situacao: r.situacao as 'Pago' | 'Pendente', formaPagamento: (r.forma_pagamento ?? '') as FormaPagamento,
      valor: Number(r.valor) || 0, obs: r.obs ?? '',
    })));
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => { load(); }, [load]);

  // Filter alunos by selected turma
  const filteredAlunos = selectedTurma === 'all' ? alunos : alunos.filter(a => a.turmaId === selectedTurma);

  // Get mensalidade for aluno
  const getMensalidade = (alunoId: string) => mensalidades.find(m => m.alunoId === alunoId);

  const updateMensalidade = async (aluno: Aluno, field: keyof Mensalidade, value: string | number) => {
    const existing = getMensalidade(aluno.id);
    const key = `${aluno.id}-${field}`;
    setSaving(prev => new Set(prev).add(key));

    const updatedField: Partial<Record<string, string | number>> = { [field]: value };
    if (field === 'situacao' && value === 'Pago' && !existing?.formaPagamento) {
      updatedField['forma_pagamento'] = 'Dinheiro';
    }

    if (existing) {
      const dbField = field === 'formaPagamento' ? 'forma_pagamento' : field === 'alunoId' ? 'aluno_id' : field === 'turmaId' ? 'turma_id' : field;
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

    await load();
    setSaving(prev => { const n = new Set(prev); n.delete(key); return n; });
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
    const ml = selectedMonth.split('-');
    const mesLabel = `${MONTHS_LABELS[parseInt(ml[1]) - 1]} ${ml[0]}`;
    const turmaLabel = selectedTurma === 'all' ? 'Todas as Turmas' : (turmas.find(t => t.id === selectedTurma)?.nome || '');
    const lista = tipo === 'geral' ? filteredAlunos : tipo === 'pagos' ? pagos : pendentes;

    // Header
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, 210, 35, 'F');
    try {
      doc.addImage('/logo-esteadeb.png', 'PNG', 10, 5, 40, 14, undefined, 'FAST');
    } catch (_e) { /* logo not available */ }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE MENSALIDADES', 105, 15, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`${mesLabel} — ${turmaLabel}`, 105, 22, { align: 'center' });
    doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 105, 28, { align: 'center' });

    // Summary
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

    // Table
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
    doc.text('Situação', 188, y + 5.5, { align: 'right' });
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
      doc.setTextColor(sit === 'Pago' ? 0 : 185, sit === 'Pago' ? 128 : 28, sit === 'Pago' ? 0 : 28);
      doc.setFont('helvetica', 'bold');
      doc.text(sit, 198, y + 5, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += 7.5;
    });

    doc.save(`Mensalidade_${tipo}_${mesLabel.replace(' ', '_')}.pdf`);
    toast.success('Relatório gerado!');
  };

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
            <SelectContent>{monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedTurma} onValueChange={setSelectedTurma}>
            <SelectTrigger className="form-input w-[180px]"><SelectValue placeholder="Todas as turmas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as turmas</SelectItem>
              {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5 h-9"><RefreshCw className="w-3.5 h-3.5" />Atualizar</Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => generateRelatorio('geral')} className="gap-1.5 h-9 text-xs"><CreditCard className="w-3.5 h-3.5" />PDF Geral</Button>
            <Button variant="outline" size="sm" onClick={() => generateRelatorio('pagos')} className="gap-1.5 h-9 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">PDF Pagos</Button>
            <Button variant="outline" size="sm" onClick={() => generateRelatorio('pendentes')} className="gap-1.5 h-9 text-xs text-red-700 border-red-200 hover:bg-red-50">PDF Pendentes</Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Alunos', value: filteredAlunos.length, icon: CreditCard, color: 'text-primary', bg: 'bg-primary/10' },
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
          <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" />Formas de Pagamento</p>
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
                {filteredAlunos.map((a, i) => {
                  const m = getMensalidade(a.id);
                  const isPago = m?.situacao === 'Pago';
                  return (
                    <tr key={a.id} className="table-row">
                      <td className="table-td">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${isPago ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                            {a.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm">{a.nome}</p>
                            {a.telefone && <p className="text-xs text-muted-foreground">{a.telefone}</p>}
                          </div>
                        </div>
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
                          value={m?.formaPagamento || ''}
                          onValueChange={v => updateMensalidade(a, 'formaPagamento', v)}
                        >
                          <SelectTrigger className="h-8 text-xs form-input w-36"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">—</SelectItem>
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
