import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Turma } from '@/types/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3, TrendingUp, DollarSign, RefreshCw, Filter,
  AlertCircle, ChevronDown, ChevronUp, Users, BookOpen, Percent,
} from 'lucide-react';
import { toast } from 'sonner';

const MONTHS_LABELS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const mesLabel = (mes: string) => { const [y,m] = mes.split('-'); return `${MONTHS_LABELS[parseInt(m)-1]} ${y}`; };

const getMonthOptions = () => {
  const opts: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  const now = new Date();
  for (let i = -6; i < 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!seen.has(val)) { seen.add(val); opts.push({ value: val, label: mesLabel(val) }); }
  }
  for (let m = 1; m <= 12; m++) {
    const val = `2026-${String(m).padStart(2,'0')}`;
    if (!seen.has(val)) { seen.add(val); opts.push({ value: val, label: mesLabel(val) }); }
  }
  opts.sort((a,b) => a.value.localeCompare(b.value));
  return opts;
};

interface FinanceRow {
  dinheiroTotal: number; dinheiroQtd: number;
  pixTotal: number; pixQtd: number;
  cartAssTotal: number; cartAssQtd: number; cartAssLiq: number;
  cartDebTotal: number; cartDebQtd: number; cartDebLiq: number;
  totalBruto: number; totalLiquido: number;
  totalAlunos: number; totalPagos: number;
  totalApostilas: number;
}

const FinanceiroTab = () => {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [finance, setFinance] = useState<FinanceRow | null>(null);

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedTurma, setSelectedTurma] = useState('all');
  const [commissaoPerc, setComissaoPerc] = useState('12');
  const [showTaxaInfo, setShowTaxaInfo] = useState(false);
  const monthOptions = getMonthOptions();

  // Taxa cartão
  const TAXA_ASSINATURA = 0.05; // 5%
  const TAXA_DEBITO = 0.02;    // 2%

  const loadData = useCallback(async () => {
    setLoading(true); setLoadError('');

    const [tRes, mRes, aRes] = await Promise.all([
      supabase.from('classes').select('*').order('nome'),
      supabase.from('mensalidades').select('*').eq('mes', selectedMonth),
      supabase.from('alunos').select('id, turma_id').eq('ativo', true),
    ]);

    if (tRes.error || mRes.error) {
      setLoadError((tRes.error || mRes.error)?.message || 'Erro ao carregar');
      setLoading(false); return;
    }

    if (tRes.data) setTurmas(tRes.data.map(r => ({
      id: r.id, nome: r.nome, turno: r.turno as 'Manhã'|'Tarde'|'Noite',
      disciplina: r.disciplina ?? '', professor: r.professor ?? '',
      diasSemana: r.dias_semana ?? '', nucleo: r.nucleo ?? '',
      honorario: Number(r.honorario) || 0, createdAt: r.created_at,
    })));

    const allAlunos = aRes.data || [];
    const filteredAlunoIds = selectedTurma === 'all'
      ? allAlunos.map((a: { id: string }) => a.id)
      : allAlunos.filter((a: { turma_id: string | null }) => a.turma_id === selectedTurma).map((a: { id: string }) => a.id);

    const mensalidades = (mRes.data || []).filter(m => filteredAlunoIds.includes(m.aluno_id));

    let dinheiroTotal = 0, dinheiroQtd = 0;
    let pixTotal = 0, pixQtd = 0;
    let cartAssTotal = 0, cartAssQtd = 0;
    let cartDebTotal = 0, cartDebQtd = 0;
    let totalApostilas = 0;

    mensalidades.forEach(m => {
      const d = Number(m.dinheiro) || 0;
      const p = Number(m.pix_deposito) || 0;
      const ca = Number(m.cartao_assinatura) || 0;
      const cd = Number(m.cartao_debito) || 0;
      if (d > 0) { dinheiroTotal += d; dinheiroQtd++; }
      if (p > 0) { pixTotal += p; pixQtd++; }
      if (ca > 0) { cartAssTotal += ca; cartAssQtd++; }
      if (cd > 0) { cartDebTotal += cd; cartDebQtd++; }
      totalApostilas += Number(m.qtd_apostilas) || 0;
    });

    const cartAssLiq = cartAssTotal * (1 - TAXA_ASSINATURA);
    const cartDebLiq = cartDebTotal * (1 - TAXA_DEBITO);
    const totalBruto = dinheiroTotal + pixTotal + cartAssTotal + cartDebTotal;
    const totalLiquido = dinheiroTotal + pixTotal + cartAssLiq + cartDebLiq;
    const totalPagos = mensalidades.filter(m => m.situacao === 'Pago').length;
    const totalAlunos = filteredAlunoIds.length;

    setFinance({
      dinheiroTotal, dinheiroQtd, pixTotal, pixQtd,
      cartAssTotal, cartAssQtd, cartAssLiq,
      cartDebTotal, cartDebQtd, cartDebLiq,
      totalBruto, totalLiquido, totalAlunos, totalPagos, totalApostilas,
    });
    setLoading(false);
  }, [selectedMonth, selectedTurma]);

  useEffect(() => { loadData(); }, [loadData]);

  const comissao = finance ? finance.totalLiquido * (parseFloat(commissaoPerc) / 100) : 0;

  const turmasFiltradas = selectedTurma === 'all' ? turmas : turmas.filter(t => t.id === selectedTurma);
  const totalHonorarios = turmasFiltradas.reduce((s, t) => s + t.honorario, 0);

  const handleHonorario = async (turmaId: string, val: string) => {
    const { error } = await supabase.from('classes').update({ honorario: parseFloat(val) || 0 }).eq('id', turmaId);
    if (error) toast.error('Erro ao salvar');
    else {
      setTurmas(prev => prev.map(t => t.id === turmaId ? { ...t, honorario: parseFloat(val) || 0 } : t));
      toast.success('Honorário salvo');
    }
  };

  const exportPDF = async () => {
    if (!finance) return;
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const mesLab = mesLabel(selectedMonth);
    const turmaLab = selectedTurma === 'all' ? 'Todas as Turmas' : (turmas.find(t => t.id === selectedTurma)?.nome || '');
    const commissaoVal = finance.totalLiquido * (parseFloat(commissaoPerc)/100);

    doc.setFillColor(30,64,175); doc.rect(0,0,210,30,'F');
    try { doc.addImage('/logo-esteadeb.png','PNG',10,5,45,14,undefined,'FAST'); } catch (_e) { /* skip */ }
    doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text('RESUMO FINANCEIRO', 148,14,{align:'center'});
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text(`${mesLab} — ${turmaLab}`, 148,22,{align:'center'});
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 148,27,{align:'center'});

    let y = 40;
    doc.setTextColor(0,0,0); doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text('RESUMO POR FORMA DE PAGAMENTO', 15, y); y+=8;

    const rows = [
      ['Dinheiro', `R$ ${finance.dinheiroTotal.toFixed(2).replace('.',',')}`, String(finance.dinheiroQtd), '—', `R$ ${finance.dinheiroTotal.toFixed(2).replace('.',',')}`],
      ['Pix / Dep. / Transf.', `R$ ${finance.pixTotal.toFixed(2).replace('.',',')}`, String(finance.pixQtd), '—', `R$ ${finance.pixTotal.toFixed(2).replace('.',',')}`],
      [`Cartão Assinatura (-${(TAXA_ASSINATURA*100).toFixed(1)}%)`, `R$ ${finance.cartAssTotal.toFixed(2).replace('.',',')}`, String(finance.cartAssQtd), `- R$ ${(finance.cartAssTotal*TAXA_ASSINATURA).toFixed(2).replace('.',',')}`, `R$ ${finance.cartAssLiq.toFixed(2).replace('.',',')}`],
      [`Cartão Débito (-${(TAXA_DEBITO*100).toFixed(1)}%)`, `R$ ${finance.cartDebTotal.toFixed(2).replace('.',',')}`, String(finance.cartDebQtd), `- R$ ${(finance.cartDebTotal*TAXA_DEBITO).toFixed(2).replace('.',',')}`, `R$ ${finance.cartDebLiq.toFixed(2).replace('.',',')}`],
    ];

    doc.setFillColor(30,64,175); doc.rect(15,y,180,7,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
    doc.text('Forma',17,y+5); doc.text('Bruto',75,y+5); doc.text('Qtd',105,y+5); doc.text('Taxa',125,y+5); doc.text('Líquido',165,y+5); y+=7;

    doc.setTextColor(0,0,0);
    rows.forEach((r, i) => {
      doc.setFillColor(i%2===0?255:248); doc.rect(15,y,180,7,'F');
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      doc.text(r[0],17,y+5); doc.text(r[1],75,y+5); doc.text(r[2],105,y+5); doc.text(r[3],125,y+5); doc.text(r[4],165,y+5); y+=7;
    });

    y+=3;
    doc.setFillColor(15,40,120); doc.rect(15,y,180,8,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text('TOTAL LÍQUIDO (após taxas)',17,y+5.5);
    doc.text(`R$ ${finance.totalLiquido.toFixed(2).replace('.',',')}`,165,y+5.5); y+=8;

    y+=5;
    doc.setTextColor(0,0,0); doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text('COMISSÃO DE COORDENAÇÃO', 15, y); y+=8;
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text(`Percentual: ${commissaoPerc}% sobre total líquido (R$ ${finance.totalLiquido.toFixed(2).replace('.',',')})`,15,y); y+=7;
    doc.setFillColor(16,185,129); doc.rect(15,y,180,8,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text(`Comissão do Coordenador: R$ ${commissaoVal.toFixed(2).replace('.',',')}`,15,y+5.5); y+=8;

    if (turmasFiltradas.some(t => t.honorario > 0)) {
      y+=5;
      doc.setTextColor(0,0,0); doc.setFontSize(11); doc.setFont('helvetica','bold');
      doc.text('HONORÁRIOS DOS PROFESSORES', 15, y); y+=8;
      doc.setFillColor(30,64,175); doc.rect(15,y,180,7,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
      doc.text('Turma / Disciplina',17,y+5); doc.text('Professor',100,y+5); doc.text('Honorário',165,y+5); y+=7;
      doc.setTextColor(0,0,0);
      turmasFiltradas.filter(t=>t.honorario>0).forEach((t,i) => {
        doc.setFillColor(i%2===0?255:248); doc.rect(15,y,180,6.5,'F');
        doc.setFontSize(8); doc.setFont('helvetica','normal');
        doc.text(`${t.nome} — ${t.disciplina||'—'}`,17,y+4.5);
        doc.text(t.professor||'—',100,y+4.5);
        doc.text(`R$ ${t.honorario.toFixed(2).replace('.',',')}`,165,y+4.5); y+=6.5;
      });
    }

    doc.save(`Financeiro_${mesLab.replace(' ','_')}.pdf`);
    toast.success('Relatório financeiro gerado!');
  };

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.',',')}`;

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
          <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5 h-9">
            <RefreshCw className="w-3.5 h-3.5" />Atualizar
          </Button>
          <Button size="sm" onClick={exportPDF} disabled={!finance} className="gap-1.5 h-9 ml-auto">
            <BarChart3 className="w-3.5 h-3.5" />Exportar PDF Financeiro
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{loadError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="loading-spinner" /></div>
      ) : finance && (
        <>
          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="content-card p-4 bg-primary/5 border-0">
              <div className="flex justify-between items-start">
                <div><p className="text-xs text-muted-foreground">Total Bruto</p><p className="text-xl font-bold text-primary">{fmt(finance.totalBruto)}</p></div>
                <TrendingUp className="w-5 h-5 text-primary opacity-40" />
              </div>
            </div>
            <div className="content-card p-4 bg-emerald-50 border-0">
              <div className="flex justify-between items-start">
                <div><p className="text-xs text-muted-foreground">Total Líquido</p><p className="text-xl font-bold text-emerald-600">{fmt(finance.totalLiquido)}</p></div>
                <DollarSign className="w-5 h-5 text-emerald-600 opacity-40" />
              </div>
            </div>
            <div className="content-card p-4 bg-blue-50 border-0">
              <div className="flex justify-between items-start">
                <div><p className="text-xs text-muted-foreground">Alunos Pagos</p><p className="text-xl font-bold text-blue-600">{finance.totalPagos}/{finance.totalAlunos}</p></div>
                <Users className="w-5 h-5 text-blue-600 opacity-40" />
              </div>
            </div>
            <div className="content-card p-4 bg-amber-50 border-0">
              <div className="flex justify-between items-start">
                <div><p className="text-xs text-muted-foreground">Apostilas</p><p className="text-xl font-bold text-amber-600">{finance.totalApostilas}</p></div>
                <BookOpen className="w-5 h-5 text-amber-600 opacity-40" />
              </div>
            </div>
          </div>

          {/* Financial breakdown */}
          <div className="content-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />Resumo por Forma de Pagamento — {mesLabel(selectedMonth)}
              </p>
              <button onClick={() => setShowTaxaInfo(!showTaxaInfo)} className="text-xs text-primary flex items-center gap-1">
                {showTaxaInfo ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
                Taxas aplicadas
              </button>
            </div>
            {showTaxaInfo && (
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 flex gap-4">
                <span>Cartão Assinatura: <strong>-5,0%</strong></span>
                <span>Cartão Débito: <strong>-2,0%</strong></span>
                <span>Dinheiro e Pix: <strong>sem taxa</strong></span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-head">
                    <th className="table-th text-left">Forma de Pagamento</th>
                    <th className="table-th text-right">Valor Bruto</th>
                    <th className="table-th text-center">Qtd</th>
                    <th className="table-th text-right hidden sm:table-cell">Taxa</th>
                    <th className="table-th text-right">Valor Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { label: 'Dinheiro', bruto: finance.dinheiroTotal, qtd: finance.dinheiroQtd, taxa: 0, liq: finance.dinheiroTotal, color: 'text-green-600' },
                    { label: 'Pix / Depósito / Transferência', bruto: finance.pixTotal, qtd: finance.pixQtd, taxa: 0, liq: finance.pixTotal, color: 'text-blue-600' },
                    { label: `Cartão Assinatura (-${(TAXA_ASSINATURA*100).toFixed(1)}%)`, bruto: finance.cartAssTotal, qtd: finance.cartAssQtd, taxa: finance.cartAssTotal*TAXA_ASSINATURA, liq: finance.cartAssLiq, color: 'text-purple-600' },
                    { label: `Cartão Débito (-${(TAXA_DEBITO*100).toFixed(1)}%)`, bruto: finance.cartDebTotal, qtd: finance.cartDebQtd, taxa: finance.cartDebTotal*TAXA_DEBITO, liq: finance.cartDebLiq, color: 'text-indigo-600' },
                  ].map(row => (
                    <tr key={row.label} className="table-row">
                      <td className="table-td">
                        <span className="text-sm font-medium text-foreground">{row.label}</span>
                      </td>
                      <td className="table-td text-right">
                        <span className={`font-semibold text-sm ${row.bruto > 0 ? row.color : 'text-muted-foreground'}`}>
                          {row.bruto > 0 ? fmt(row.bruto) : '—'}
                        </span>
                      </td>
                      <td className="table-td text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${row.qtd > 0 ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
                          {row.qtd}
                        </span>
                      </td>
                      <td className="table-td text-right hidden sm:table-cell">
                        {row.taxa > 0
                          ? <span className="text-xs text-red-500 font-medium">- {fmt(row.taxa)}</span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="table-td text-right">
                        <span className="font-bold text-sm text-foreground">
                          {row.liq > 0 ? fmt(row.liq) : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-primary/5">
                    <td className="table-td font-bold text-foreground">Total Bruto</td>
                    <td className="table-td text-right font-bold text-foreground">{fmt(finance.totalBruto)}</td>
                    <td className="table-td text-center font-bold text-primary">{finance.dinheiroQtd+finance.pixQtd+finance.cartAssQtd+finance.cartDebQtd}</td>
                    <td className="table-td hidden sm:table-cell text-right text-xs text-red-500 font-medium">
                      {(finance.cartAssTotal*TAXA_ASSINATURA + finance.cartDebTotal*TAXA_DEBITO) > 0
                        ? `- ${fmt(finance.cartAssTotal*TAXA_ASSINATURA + finance.cartDebTotal*TAXA_DEBITO)}` : '—'}
                    </td>
                    <td className="table-td text-right font-bold text-emerald-600">{fmt(finance.totalLiquido)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Comissão */}
          <div className="content-card p-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <Percent className="w-4 h-4 text-primary" />Comissão de Coordenação
            </h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Percentual (%):</label>
                <Input
                  type="number" min="0" max="100" step="0.5"
                  className="h-9 w-24 form-input text-center font-bold"
                  value={commissaoPerc}
                  onChange={e => setComissaoPerc(e.target.value)}
                />
              </div>
              <div className="flex gap-4 flex-wrap">
                <div className="content-card p-3 bg-muted/40 border-0 flex items-center gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Base (Total Líquido)</p>
                    <p className="font-bold text-foreground">{fmt(finance.totalLiquido)}</p>
                  </div>
                </div>
                <div className="content-card p-3 bg-emerald-50 border-0 flex items-center gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Comissão ({commissaoPerc}%)</p>
                    <p className="font-bold text-emerald-600 text-xl">{fmt(comissao)}</p>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Fórmula: R$ {finance.totalLiquido.toFixed(2).replace('.',',')} × {commissaoPerc}% = <strong className="text-foreground">R$ {comissao.toFixed(2).replace('.',',')}</strong>
            </p>
          </div>

          {/* Honorários professores */}
          <div className="content-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />Honorários dos Professores
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Defina o valor de honorário por turma/disciplina</p>
            </div>
            {turmas.length === 0 ? (
              <div className="empty-state py-8">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma turma cadastrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-head">
                      <th className="table-th text-left">Turma / Disciplina</th>
                      <th className="table-th text-left hidden sm:table-cell">Professor</th>
                      <th className="table-th text-left hidden md:table-cell">Turno</th>
                      <th className="table-th text-right">Honorário R$</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {turmas.map(t => (
                      <tr key={t.id} className="table-row">
                        <td className="table-td">
                          <p className="font-medium text-sm text-foreground">{t.nome}</p>
                          {t.disciplina && <p className="text-xs text-muted-foreground">{t.disciplina}</p>}
                        </td>
                        <td className="table-td hidden sm:table-cell text-sm text-muted-foreground">{t.professor || '—'}</td>
                        <td className="table-td hidden md:table-cell">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                            ${t.turno==='Manhã' ? 'bg-amber-100 text-amber-700' : t.turno==='Tarde' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {t.turno}
                          </span>
                        </td>
                        <td className="table-td text-right">
                          <Input
                            type="number" min="0" step="10"
                            className="h-8 text-right text-sm form-input w-28 ml-auto"
                            defaultValue={t.honorario || ''}
                            placeholder="0,00"
                            onBlur={e => handleHonorario(t.id, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {totalHonorarios > 0 && (
                    <tfoot>
                      <tr className="bg-primary/5">
                        <td colSpan={3} className="table-td font-bold text-foreground">Total Honorários</td>
                        <td className="table-td text-right font-bold text-primary">{fmt(totalHonorarios)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FinanceiroTab;
