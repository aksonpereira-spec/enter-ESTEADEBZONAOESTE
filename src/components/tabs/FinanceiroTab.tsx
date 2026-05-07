import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Turma } from '@/types/school';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3, TrendingUp, DollarSign, RefreshCw, Filter,
  AlertCircle, ChevronDown, ChevronUp, Users, BookOpen, Percent, FileSpreadsheet,
  Check, X, CalendarX,
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

interface DiscHonorario {
  disciplinaTurmaId: string;
  turmaId: string; turmaName: string; moduloNome: string;
  nome: string; professor: string; honorario: number;
  pago: boolean; pagoEm?: string;
}

interface MensalidadeExport {
  matricula: string; nome: string; turma: string;
  situacao: string; dinheiro: number; pix: number;
  cartAss: number; cartDeb: number; total: number;
  apostilas: string; qtdApostilas: number; obs: string;
}

const FinanceiroTab = () => {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [finance, setFinance] = useState<FinanceRow | null>(null);
  const [discHonorarios, setDiscHonorarios] = useState<DiscHonorario[]>([]);
  const [mensalidadesExport, setMensalidadesExport] = useState<MensalidadeExport[]>([]);
  const [hasChamadas, setHasChamadas] = useState(false);

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedTurma, setSelectedTurma] = useState('all');
  const [commissaoPerc, setComissaoPerc] = useState('12');
  const [showTaxaInfo, setShowTaxaInfo] = useState(false);
  const monthOptions = getMonthOptions();

  const TAXA_ASSINATURA = 0.05;
  const TAXA_DEBITO = 0.02;

  const loadData = useCallback(async () => {
    setLoading(true); setLoadError('');

    const [y, m] = selectedMonth.split('-');
    const mesStart = `${y}-${m}-01`;
    const nextM = parseInt(m) === 12 ? `${parseInt(y)+1}-01-01` : `${y}-${String(parseInt(m)+1).padStart(2,'0')}-01`;

    const [tRes, mRes, aRes, sessRes, pagRes] = await Promise.all([
      supabase.from('classes').select('*').order('nome'),
      supabase.from('mensalidades').select('*').eq('mes', selectedMonth),
      supabase.from('alunos').select('id, nome, matricula, turma_id').eq('ativo', true),
      supabase.from('attendance_sessions').select('turma_id').gte('data', mesStart).lt('data', nextM),
      supabase.from('honorarios_pagamentos').select('disciplina_turma_id, pago_em').eq('mes', selectedMonth),
    ]);

    if (tRes.error || mRes.error) {
      setLoadError((tRes.error || mRes.error)?.message || 'Erro ao carregar');
      setLoading(false); return;
    }

    const allTurmas = (tRes.data || []).map(r => ({
      id: r.id, nome: r.nome, turno: r.turno as 'Manhã'|'Tarde'|'Noite',
      disciplina: r.disciplina ?? '', professor: r.professor ?? '',
      diasSemana: r.dias_semana ?? '', nucleo: r.nucleo ?? '',
      honorario: Number(r.honorario) || 0, createdAt: r.created_at,
    }));
    setTurmas(allTurmas);

    // Turmas que tiveram chamada neste mês
    const turmasComChamada = new Set((sessRes.data || []).map(s => s.turma_id));
    setHasChamadas(turmasComChamada.size > 0);

    // Pagamentos já registrados neste mês
    const pagosMap = new Map<string, string>(
      (pagRes.data || []).map(p => [p.disciplina_turma_id, p.pago_em])
    );

    // Load disciplines honorários
    const turmaIds = selectedTurma === 'all'
      ? allTurmas.map(t => t.id)
      : [selectedTurma];

    const { data: modsData } = await supabase
      .from('modulos')
      .select('id, nome, turma_id, disciplinas_turma(id, nome, professor, honorario)')
      .in('turma_id', turmaIds);

    const discs: DiscHonorario[] = [];
    (modsData || []).forEach(mod => {
      // Só mostra disciplinas de turmas que tiveram chamada neste mês
      if (!turmasComChamada.has(mod.turma_id)) return;
      const turma = allTurmas.find(t => t.id === mod.turma_id);
      ((mod.disciplinas_turma as { id: string; nome: string; professor: string; honorario: number }[]) || []).forEach(d => {
        if ((Number(d.honorario) || 0) > 0) {
          discs.push({
            disciplinaTurmaId: d.id,
            turmaId: mod.turma_id, turmaName: turma?.nome || '—',
            moduloNome: mod.nome, nome: d.nome, professor: d.professor || '—',
            honorario: Number(d.honorario) || 0,
            pago: pagosMap.has(d.id),
            pagoEm: pagosMap.get(d.id),
          });
        }
      });
    });
    setDiscHonorarios(discs);

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

    // Build export data
    const alunoMap = Object.fromEntries(allAlunos.map((a: { id: string; nome: string; matricula: string | null; turma_id: string | null }) => [a.id, a]));
    const turmaMap = Object.fromEntries(allTurmas.map(t => [t.id, t]));
    const exportRows: MensalidadeExport[] = filteredAlunoIds.map(alunoId => {
      const aluno = alunoMap[alunoId];
      const ms = mensalidades.find(x => x.aluno_id === alunoId);
      const turma = aluno?.turma_id ? turmaMap[aluno.turma_id] : null;
      return {
        matricula: aluno?.matricula || '',
        nome: aluno?.nome || '',
        turma: turma?.nome || '—',
        situacao: ms?.situacao || 'Pendente',
        dinheiro: Number(ms?.dinheiro) || 0,
        pix: Number(ms?.pix_deposito) || 0,
        cartAss: Number(ms?.cartao_assinatura) || 0,
        cartDeb: Number(ms?.cartao_debito) || 0,
        total: Number(ms?.valor) || 0,
        apostilas: ms?.apostilas || 'Não',
        qtdApostilas: Number(ms?.qtd_apostilas) || 0,
        obs: ms?.obs || '',
      };
    });
    setMensalidadesExport(exportRows);

    mensalidades.forEach(ms => {
      const d = Number(ms.dinheiro) || 0;
      const p = Number(ms.pix_deposito) || 0;
      const ca = Number(ms.cartao_assinatura) || 0;
      const cd = Number(ms.cartao_debito) || 0;
      if (d > 0) { dinheiroTotal += d; dinheiroQtd++; }
      if (p > 0) { pixTotal += p; pixQtd++; }
      if (ca > 0) { cartAssTotal += ca; cartAssQtd++; }
      if (cd > 0) { cartDebTotal += cd; cartDebQtd++; }
      totalApostilas += Number(ms.qtd_apostilas) || 0;
    });

    const cartAssLiq = cartAssTotal * (1 - TAXA_ASSINATURA);
    const cartDebLiq = cartDebTotal * (1 - TAXA_DEBITO);
    const totalBruto = dinheiroTotal + pixTotal + cartAssTotal + cartDebTotal;
    const totalLiquido = dinheiroTotal + pixTotal + cartAssLiq + cartDebLiq;
    const totalPagos = mensalidades.filter(ms => ms.situacao === 'Pago').length;
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

  // ── Dar Baixa / Desfazer Baixa ──────────────────────────────────────────────
  const darBaixa = async (disciplinaTurmaId: string) => {
    const { error } = await supabase.from('honorarios_pagamentos')
      .insert({ disciplina_turma_id: disciplinaTurmaId, mes: selectedMonth });
    if (error) { toast.error('Erro ao dar baixa'); return; }
    toast.success('Honorário dado baixa');
    loadData();
  };

  const desfazerBaixa = async (disciplinaTurmaId: string) => {
    const { error } = await supabase.from('honorarios_pagamentos')
      .delete().eq('disciplina_turma_id', disciplinaTurmaId).eq('mes', selectedMonth);
    if (error) { toast.error('Erro ao desfazer baixa'); return; }
    toast.success('Baixa desfeita');
    loadData();
  };

  const comissao = finance ? finance.totalLiquido * (parseFloat(commissaoPerc) / 100) : 0;
  const turmasFiltradas = selectedTurma === 'all' ? turmas : turmas.filter(t => t.id === selectedTurma);
  const totalHonorarios = discHonorarios.reduce((s, d) => s + d.honorario, 0);
  const totalPendente = discHonorarios.filter(d => !d.pago).reduce((s, d) => s + d.honorario, 0);
  const totalBaixado = discHonorarios.filter(d => d.pago).reduce((s, d) => s + d.honorario, 0);

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.',',')}`;

  // ─── PDF Export ───────────────────────────────────────────────────────────────
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
      [`Cartao Assinatura (-${(TAXA_ASSINATURA*100).toFixed(1)}%)`, `R$ ${finance.cartAssTotal.toFixed(2).replace('.',',')}`, String(finance.cartAssQtd), `- R$ ${(finance.cartAssTotal*TAXA_ASSINATURA).toFixed(2).replace('.',',')}`, `R$ ${finance.cartAssLiq.toFixed(2).replace('.',',')}`],
      [`Cartao Debito (-${(TAXA_DEBITO*100).toFixed(1)}%)`, `R$ ${finance.cartDebTotal.toFixed(2).replace('.',',')}`, String(finance.cartDebQtd), `- R$ ${(finance.cartDebTotal*TAXA_DEBITO).toFixed(2).replace('.',',')}`, `R$ ${finance.cartDebLiq.toFixed(2).replace('.',',')}`],
    ];

    doc.setFillColor(30,64,175); doc.rect(15,y,180,7,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
    doc.text('Forma',17,y+5); doc.text('Bruto',75,y+5); doc.text('Qtd',105,y+5); doc.text('Taxa',125,y+5); doc.text('Liquido',165,y+5); y+=7;
    doc.setTextColor(0,0,0);
    rows.forEach((r, i) => {
      doc.setFillColor(i%2===0?255:248); doc.rect(15,y,180,7,'F');
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      doc.text(r[0],17,y+5); doc.text(r[1],75,y+5); doc.text(r[2],105,y+5); doc.text(r[3],125,y+5); doc.text(r[4],165,y+5); y+=7;
    });

    y+=3;
    doc.setFillColor(15,40,120); doc.rect(15,y,180,8,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.text('TOTAL LIQUIDO (apos taxas)',17,y+5.5);
    doc.text(`R$ ${finance.totalLiquido.toFixed(2).replace('.',',')}`,165,y+5.5); y+=8;

    y+=5;
    doc.setTextColor(0,0,0); doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text('COMISSAO DE COORDENACAO', 15, y); y+=8;
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text(`Percentual: ${commissaoPerc}% sobre total liquido (R$ ${finance.totalLiquido.toFixed(2).replace('.',',')})`,15,y); y+=7;
    doc.setFillColor(16,185,129); doc.rect(15,y,180,8,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text(`Comissao do Coordenador: R$ ${commissaoVal.toFixed(2).replace('.',',')}`,15,y+5.5); y+=8;

    if (discHonorarios.length > 0) {
      y+=5;
      doc.setTextColor(0,0,0); doc.setFontSize(11); doc.setFont('helvetica','bold');
      doc.text('HONORARIOS DOS PROFESSORES', 15, y); y+=8;
      doc.setFillColor(30,64,175); doc.rect(15,y,180,7,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
      doc.text('Turma / Modulo',17,y+5); doc.text('Disciplina',75,y+5); doc.text('Professor',120,y+5); doc.text('Honorario',155,y+5); doc.text('Situacao',177,y+5); y+=7;
      doc.setTextColor(0,0,0);
      discHonorarios.forEach((d,i) => {
        if (y > 270) { doc.addPage(); y = 15; }
        doc.setFillColor(i%2===0?255:248); doc.rect(15,y,180,6.5,'F');
        doc.setFontSize(7.5); doc.setFont('helvetica','normal');
        doc.text(`${d.turmaName} — ${d.moduloNome}`.substring(0,30),17,y+4.5);
        doc.text(d.nome.substring(0,20),75,y+4.5);
        doc.text(d.professor.substring(0,18),120,y+4.5);
        doc.text(`R$ ${d.honorario.toFixed(2).replace('.',',')}`,155,y+4.5);
        doc.text(d.pago ? 'Baixado' : 'Pendente',177,y+4.5); y+=6.5;
      });
      y+=3;
      doc.setFillColor(15,40,120); doc.rect(15,y,180,7,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
      doc.text('TOTAL HONORARIOS',17,y+5);
      doc.text(`R$ ${totalHonorarios.toFixed(2).replace('.',',')}`,155,y+5);
    }

    doc.save(`Financeiro_${mesLab.replace(' ','_')}.pdf`);
    toast.success('Relatório financeiro gerado!');
  };

  // ─── Excel Export ─────────────────────────────────────────────────────────────
  const exportExcel = async () => {
    if (!finance) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const mesLab = mesLabel(selectedMonth);

    const resumoData = [
      ['RESUMO FINANCEIRO — ' + mesLab],
      [],
      ['Forma de Pagamento', 'Valor Bruto', 'Qtd', 'Taxa', 'Valor Líquido'],
      ['Dinheiro', finance.dinheiroTotal, finance.dinheiroQtd, 0, finance.dinheiroTotal],
      ['Pix / Depósito / Transferência', finance.pixTotal, finance.pixQtd, 0, finance.pixTotal],
      [`Cartão Assinatura (-${(TAXA_ASSINATURA*100).toFixed(1)}%)`, finance.cartAssTotal, finance.cartAssQtd, -(finance.cartAssTotal*TAXA_ASSINATURA), finance.cartAssLiq],
      [`Cartão Débito (-${(TAXA_DEBITO*100).toFixed(1)}%)`, finance.cartDebTotal, finance.cartDebQtd, -(finance.cartDebTotal*TAXA_DEBITO), finance.cartDebLiq],
      [],
      ['TOTAL BRUTO', finance.totalBruto, '', '', ''],
      ['TOTAL LÍQUIDO', finance.totalLiquido, '', '', ''],
      [],
      ['Comissão Coordenador (' + commissaoPerc + '%)', comissao],
      ['Total Honorários Professores', totalHonorarios],
      ['Total Honorários Baixados', totalBaixado],
      ['Total Honorários Pendentes', totalPendente],
      [],
      ['Alunos Ativos', finance.totalAlunos],
      ['Alunos Pagos', finance.totalPagos],
      ['Total Apostilas', finance.totalApostilas],
    ];
    if (discHonorarios.length > 0) {
      resumoData.push([]);
      resumoData.push(['HONORÁRIOS POR DISCIPLINA', '', '', '', '']);
      resumoData.push(['Turma', 'Módulo', 'Disciplina', 'Professor', 'Honorário', 'Situação']);
      discHonorarios.forEach(d => resumoData.push([d.turmaName, d.moduloNome, d.nome, d.professor, d.honorario, d.pago ? 'Baixado' : 'Pendente']));
    }
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

    const mensHeader = ['Matrícula', 'Nome', 'Turma', 'Situação', 'Dinheiro (R$)', 'Pix/Dep. (R$)', 'Cart. Ass. (R$)', 'Cart. Déb. (R$)', 'Total (R$)', 'Apostilas', 'Qtd Apostilas', 'Observações'];
    const mensRows = mensalidadesExport.map(r => [
      r.matricula, r.nome, r.turma, r.situacao,
      r.dinheiro, r.pix, r.cartAss, r.cartDeb, r.total,
      r.apostilas, r.qtdApostilas, r.obs,
    ]);
    const wsMens = XLSX.utils.aoa_to_sheet([mensHeader, ...mensRows]);
    XLSX.utils.book_append_sheet(wb, wsMens, 'Mensalidades');

    const apostHeader = ['Matrícula', 'Nome', 'Turma', 'Mês', 'Qtd Apostilas'];
    const apostRows = mensalidadesExport
      .filter(r => r.apostilas === 'Sim' && r.qtdApostilas > 0)
      .map(r => [r.matricula, r.nome, r.turma, mesLab, r.qtdApostilas]);
    const wsApost = XLSX.utils.aoa_to_sheet([apostHeader, ...apostRows]);
    XLSX.utils.book_append_sheet(wb, wsApost, 'Apostilas');

    XLSX.writeFile(wb, `Financeiro_${mesLab.replace(' ','_')}.xlsx`);
    toast.success('Planilha Excel gerada!');
  };

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
          <div className="flex gap-2 ml-auto flex-wrap">
            <Button size="sm" onClick={exportPDF} disabled={!finance} className="gap-1.5 h-9">
              <BarChart3 className="w-3.5 h-3.5" />PDF Financeiro
            </Button>
            <Button size="sm" variant="outline" onClick={exportExcel} disabled={!finance} className="gap-1.5 h-9 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
              <FileSpreadsheet className="w-3.5 h-3.5" />Excel Detalhado
            </Button>
          </div>
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
                      <td className="table-td"><span className="text-sm font-medium text-foreground">{row.label}</span></td>
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
                        {row.taxa > 0 ? <span className="text-xs text-red-500 font-medium">- {fmt(row.taxa)}</span> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="table-td text-right">
                        <span className="font-bold text-sm text-foreground">{row.liq > 0 ? fmt(row.liq) : '—'}</span>
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
                <Input type="number" min="0" max="100" step="0.5"
                  className="h-9 w-24 form-input text-center font-bold"
                  value={commissaoPerc} onChange={e => setComissaoPerc(e.target.value)} />
              </div>
              <div className="flex gap-4 flex-wrap">
                <div className="content-card p-3 bg-muted/40 border-0 flex items-center gap-3">
                  <div><p className="text-xs text-muted-foreground">Base (Total Líquido)</p><p className="font-bold text-foreground">{fmt(finance.totalLiquido)}</p></div>
                </div>
                <div className="content-card p-3 bg-emerald-50 border-0 flex items-center gap-3">
                  <div><p className="text-xs text-muted-foreground">Comissão ({commissaoPerc}%)</p><p className="font-bold text-emerald-600 text-xl">{fmt(comissao)}</p></div>
                </div>
              </div>
            </div>
          </div>

          {/* Honorários dos professores por disciplina */}
          <div className="content-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />Honorários dos Professores
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aparece somente após a primeira chamada do mês ser lançada
                </p>
              </div>
              {discHonorarios.length > 0 && (
                <div className="flex gap-3 text-xs flex-wrap">
                  {totalPendente > 0 && (
                    <span className="flex items-center gap-1 text-amber-600 font-semibold">
                      Pendente: {fmt(totalPendente)}
                    </span>
                  )}
                  {totalBaixado > 0 && (
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                      <Check className="w-3 h-3" />Baixado: {fmt(totalBaixado)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Sem chamadas no mês */}
            {!hasChamadas ? (
              <div className="empty-state py-8">
                <CalendarX className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Nenhuma chamada registrada em {mesLabel(selectedMonth)}</p>
                <p className="text-xs text-muted-foreground mt-1">Os honorários aparecem após a primeira chamada do mês ser lançada na aba Chamada</p>
              </div>
            ) : discHonorarios.length === 0 ? (
              <div className="empty-state py-8">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum honorário cadastrado nas disciplinas das turmas com chamada</p>
                <p className="text-xs text-muted-foreground mt-1">Acesse a aba Turmas → Módulos para definir honorários por disciplina</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-head">
                      <th className="table-th text-left">Turma</th>
                      <th className="table-th text-left hidden sm:table-cell">Módulo</th>
                      <th className="table-th text-left">Disciplina</th>
                      <th className="table-th text-left hidden md:table-cell">Professor</th>
                      <th className="table-th text-right">Honorário</th>
                      <th className="table-th text-center">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {discHonorarios.map((d, i) => (
                      <tr key={i} className={`table-row ${d.pago ? 'bg-emerald-50/40' : ''}`}>
                        <td className="table-td">
                          <p className="font-medium text-sm text-foreground">{d.turmaName}</p>
                        </td>
                        <td className="table-td hidden sm:table-cell text-sm text-muted-foreground">{d.moduloNome}</td>
                        <td className="table-td text-sm text-foreground">{d.nome}</td>
                        <td className="table-td hidden md:table-cell text-sm text-muted-foreground">{d.professor}</td>
                        <td className="table-td text-right">
                          <span className={`font-semibold ${d.pago ? 'text-muted-foreground line-through' : 'text-emerald-600'}`}>
                            {fmt(d.honorario)}
                          </span>
                        </td>
                        <td className="table-td text-center">
                          {d.pago ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-1 rounded-full">
                                <Check className="w-3 h-3" />Baixado
                              </span>
                              <button
                                onClick={() => desfazerBaixa(d.disciplinaTurmaId)}
                                className="text-muted-foreground hover:text-red-500 transition-colors"
                                title="Desfazer baixa"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline"
                              onClick={() => darBaixa(d.disciplinaTurmaId)}
                              className="h-7 text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                              <Check className="w-3 h-3" />Dar Baixa
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {totalHonorarios > 0 && (
                    <tfoot>
                      <tr className="bg-primary/5">
                        <td colSpan={4} className="table-td font-bold text-foreground">Total Honorários</td>
                        <td className="table-td text-right font-bold text-primary">{fmt(totalHonorarios)}</td>
                        <td className="table-td text-center text-xs text-muted-foreground">
                          {discHonorarios.filter(d => d.pago).length}/{discHonorarios.length} baixados
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          {/* Turmas overview */}
          {turmasFiltradas.length > 0 && (
            <div className="content-card p-4 bg-muted/20">
              <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />Resumo — {turmasFiltradas.length} turma{turmasFiltradas.length !== 1 ? 's' : ''} | Total honorários: <span className="text-primary font-bold">{fmt(totalHonorarios)}</span>
                {totalPendente > 0 && <span className="text-amber-600 font-bold ml-2">Pendente: {fmt(totalPendente)}</span>}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FinanceiroTab;
