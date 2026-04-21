import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Student, Coordinator, Discipline, FinancialSummary, TAXA_CARTAO_ASSINATURA, TAXA_CARTAO_DEBITO, TAXA_COMISSAO } from '@/types/student';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LogOut, Plus, Search, Download, Trash2, TrendingUp, DollarSign, Percent, Users, UserCog, BookOpen, Calendar, RefreshCw, ChevronRight, Activity, BarChart2, Database, Loader2, CheckCircle, Clock, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type TabType = 'alunos' | 'coordenadores' | 'disciplinas';

const Dashboard = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('alunos');
  const [students, setStudents] = useState<Student[]>([]);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSituacao, setFilterSituacao] = useState<string>('all');
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingCoords, setLoadingCoords] = useState(true);
  const [loadingDiscs, setLoadingDiscs] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const studentsRef = useRef<Student[]>([]);
  useEffect(() => { studentsRef.current = students; }, [students]);
  const coordinatorsRef = useRef<Coordinator[]>([]);
  useEffect(() => { coordinatorsRef.current = coordinators; }, [coordinators]);
  const disciplinesRef = useRef<Discipline[]>([]);
  useEffect(() => { disciplinesRef.current = disciplines; }, [disciplines]);
  const chartRef = useRef<HTMLDivElement>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ─── Load from Supabase ────────────────────────────────────────────────────
  const loadStudents = useCallback(async () => {
    setLoadingStudents(true);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('mes', { ascending: true })
      .order('created_at', { ascending: true });
    if (!error && data) {
      // Renumber sequentially per month to avoid duplicates
      const monthCounters: Record<string, number> = {};
      setStudents(data.map(r => {
        const month = r.mes ?? '';
        if (!monthCounters[month]) monthCounters[month] = 0;
        monthCounters[month]++;
        return {
          id: r.id,
          numero: monthCounters[month],
          matricula: r.matricula ?? '',
          nome: r.nome ?? '',
          dinheiro: Number(r.dinheiro) || 0,
          pixTransferencia: Number(r.pix_transferencia) || 0,
          cartaoAssinatura: Number(r.cartao_assinatura) || 0,
          cartaoDebito: Number(r.cartao_debito) || 0,
          situacao: (r.situacao as 'Pago' | 'Pendente' | '-') ?? '-',
          apostilas: (r.apostilas as 'Sim' | 'Não') ?? 'Não',
          qtdApostilas: r.qtd_apostilas ?? 0,
          obs: r.obs ?? '',
          mes: month,
        };
      }));
    }
    setLoadingStudents(false);
  }, []);

  const loadCoordinators = useCallback(async () => {
    setLoadingCoords(true);
    const { data, error } = await supabase.from('coordinators').select('*').order('created_at', { ascending: true });
    if (!error && data) {
      setCoordinators(data.map(r => ({
        id: r.id,
        nome: r.nome ?? '',
        email: r.email ?? '',
        telefone: r.telefone ?? '',
        nucleo: r.nucleo ?? '',
        dataInicio: r.data_inicio ?? '',
      })));
    }
    setLoadingCoords(false);
  }, []);

  const loadDisciplines = useCallback(async () => {
    setLoadingDiscs(true);
    const { data, error } = await supabase.from('disciplines').select('*').order('created_at', { ascending: true });
    if (!error && data) {
      setDisciplines(data.map(r => ({
        id: r.id,
        nome: r.nome ?? '',
        professor: r.professor ?? '',
        cargaHoraria: r.carga_horaria ?? 0,
        diasSemana: r.dias_semana ?? '',
        horario: r.horario ?? '',
      })));
    }
    setLoadingDiscs(false);
  }, []);

  useEffect(() => {
    loadStudents();
    loadCoordinators();
    loadDisciplines();
  }, [loadStudents, loadCoordinators, loadDisciplines]);

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = -12; i <= 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return options;
  };

  const calculateSituacao = (s: Partial<Student>): 'Pago' | 'Pendente' | '-' => {
    if (!s.nome) return '-';
    const total = (s.dinheiro || 0) + (s.pixTransferencia || 0) + (s.cartaoAssinatura || 0) + (s.cartaoDebito || 0);
    return total > 0 ? 'Pago' : 'Pendente';
  };

  const setSaving = (id: string, on: boolean) => {
    setSavingIds(prev => {
      const next = new Set(prev);
      if (on) { next.add(id); } else { next.delete(id); }
      return next;
    });
  };

  // ─── Students CRUD ─────────────────────────────────────────────────────────
  const addStudent = async () => {
    const { error } = await supabase.from('students').insert({
      numero: 0, // trigger will renumber correctly
      matricula: '',
      nome: '',
      dinheiro: 0,
      pix_transferencia: 0,
      cartao_assinatura: 0,
      cartao_debito: 0,
      situacao: '-',
      apostilas: 'Não',
      qtd_apostilas: 0,
      obs: '',
      mes: selectedMonth,
    });
    if (!error) {
      await loadStudents(); // reload to get correct trigger-assigned numbers
      toast.success('Aluno adicionado');
    } else {
      toast.error('Erro ao adicionar aluno');
    }
  };

  const updateStudent = (id: string, field: keyof Student, value: string | number) => {
    setStudents(prev => prev.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, [field]: value };
      updated.situacao = calculateSituacao(updated);
      return updated;
    }));

    // Debounced save
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(async () => {
      setSaving(id, true);
      const student = studentsRef.current.find(s => s.id === id);
      if (!student) { setSaving(id, false); return; }
      const updated = { ...student, [field]: value };
      updated.situacao = calculateSituacao(updated);
      await supabase.from('students').update({
        matricula: updated.matricula,
        nome: updated.nome,
        dinheiro: updated.dinheiro,
        pix_transferencia: updated.pixTransferencia,
        cartao_assinatura: updated.cartaoAssinatura,
        cartao_debito: updated.cartaoDebito,
        situacao: updated.situacao,
        apostilas: updated.apostilas,
        qtd_apostilas: updated.qtdApostilas,
        obs: updated.obs,
      }).eq('id', id);
      setSaving(id, false);
    }, 800);
  };

  const deleteStudent = async (id: string) => {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (!error) {
      await loadStudents(); // reload to renumber correctly after deletion
      toast.success('Aluno excluído');
    } else {
      toast.error('Erro ao excluir aluno');
    }
  };

  // ─── Coordinators CRUD ─────────────────────────────────────────────────────
  const addCoordinator = async () => {
    const { data, error } = await supabase.from('coordinators').insert({
      nome: '', email: '', telefone: '', nucleo: '',
      data_inicio: new Date().toISOString().split('T')[0],
    }).select().single();
    if (!error && data) {
      setCoordinators(prev => [...prev, { id: data.id, nome: '', email: '', telefone: '', nucleo: '', dataInicio: data.data_inicio ?? '' }]);
      toast.success('Coordenador adicionado');
    }
  };

  const updateCoordinator = (id: string, field: keyof Coordinator, value: string) => {
    setCoordinators(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    if (saveTimers.current[`c_${id}`]) clearTimeout(saveTimers.current[`c_${id}`]);
    saveTimers.current[`c_${id}`] = setTimeout(async () => {
      setSaving(id, true);
      const coord = coordinatorsRef.current.find(c => c.id === id);
      if (!coord) { setSaving(id, false); return; }
      const updated = { ...coord, [field]: value };
      await supabase.from('coordinators').update({
        nome: updated.nome, email: updated.email,
        telefone: updated.telefone, nucleo: updated.nucleo,
        data_inicio: updated.dataInicio,
      }).eq('id', id);
      setSaving(id, false);
    }, 800);
  };

  const deleteCoordinator = async (id: string) => {
    const { error } = await supabase.from('coordinators').delete().eq('id', id);
    if (!error) {
      setCoordinators(prev => prev.filter(c => c.id !== id));
      toast.success('Coordenador excluído');
    }
  };

  // ─── Disciplines CRUD ──────────────────────────────────────────────────────
  const addDiscipline = async () => {
    const { data, error } = await supabase.from('disciplines').insert({
      nome: '', professor: '', carga_horaria: 0, dias_semana: '', horario: '',
    }).select().single();
    if (!error && data) {
      setDisciplines(prev => [...prev, { id: data.id, nome: '', professor: '', cargaHoraria: 0, diasSemana: '', horario: '' }]);
      toast.success('Disciplina adicionada');
    }
  };

  const updateDiscipline = (id: string, field: keyof Discipline, value: string | number) => {
    setDisciplines(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    if (saveTimers.current[`d_${id}`]) clearTimeout(saveTimers.current[`d_${id}`]);
    saveTimers.current[`d_${id}`] = setTimeout(async () => {
      setSaving(id, true);
      const disc = disciplinesRef.current.find(d => d.id === id);
      if (!disc) { setSaving(id, false); return; }
      const updated = { ...disc, [field]: value };
      await supabase.from('disciplines').update({
        nome: updated.nome, professor: updated.professor,
        carga_horaria: updated.cargaHoraria, dias_semana: updated.diasSemana, horario: updated.horario,
      }).eq('id', id);
      setSaving(id, false);
    }, 800);
  };

  const deleteDiscipline = async (id: string) => {
    const { error } = await supabase.from('disciplines').delete().eq('id', id);
    if (!error) {
      setDisciplines(prev => prev.filter(d => d.id !== id));
      toast.success('Disciplina excluída');
    }
  };

  // ─── Computed ──────────────────────────────────────────────────────────────
  const filteredStudents = students.filter(s => {
    const matchesMonth = s.mes === selectedMonth;
    const matchesSearch = s.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSituacao = filterSituacao === 'all' || s.situacao === filterSituacao;
    return matchesMonth && matchesSearch && matchesSituacao;
  });

  const getFinancialSummary = (): FinancialSummary => {
    const ms = students.filter(s => s.mes === selectedMonth);
    const totals = ms.reduce((acc, s) => {
      acc.dinheiro += s.dinheiro;
      acc.pixTransferencia += s.pixTransferencia;
      acc.cartaoAssinatura += s.cartaoAssinatura;
      acc.cartaoDebito += s.cartaoDebito;
      acc.apostilas += s.qtdApostilas ?? 0;
      return acc;
    }, { dinheiro: 0, pixTransferencia: 0, cartaoAssinatura: 0, cartaoDebito: 0, apostilas: 0 });

    const assinaturaLiq = totals.cartaoAssinatura * (1 - TAXA_CARTAO_ASSINATURA);
    const debitoLiq = totals.cartaoDebito * (1 - TAXA_CARTAO_DEBITO);
    const totalBruto = totals.dinheiro + totals.pixTransferencia + totals.cartaoAssinatura + totals.cartaoDebito;
    const totalLiq = totals.dinheiro + totals.pixTransferencia + assinaturaLiq + debitoLiq;
    return {
      totalDinheiro: totals.dinheiro,
      totalPix: totals.pixTransferencia,
      totalCartaoAssinatura: totals.cartaoAssinatura,
      totalCartaoAssinaturaLiquido: assinaturaLiq,
      totalCartaoDebito: totals.cartaoDebito,
      totalCartaoDebitoLiquido: debitoLiq,
      totalGeral: totalBruto,
      totalGeralLiquido: totalLiq,
      comissao: totalLiq * TAXA_COMISSAO,
      qtdAlunos: ms.filter(s => s.situacao === 'Pago').length,
      qtdApostilas: totals.apostilas,
    };
  };

  const summary = getFinancialSummary();

  const chartData = [
    { name: 'Dinheiro', valor: summary.totalDinheiro, liquido: summary.totalDinheiro },
    { name: 'Pix/Trans', valor: summary.totalPix, liquido: summary.totalPix },
    { name: 'Cartão/Ass.', valor: summary.totalCartaoAssinatura, liquido: summary.totalCartaoAssinaturaLiquido },
    { name: 'Cartão Déb.', valor: summary.totalCartaoDebito, liquido: summary.totalCartaoDebitoLiquido },
  ];

  const monthLabel = getMonthOptions().find(m => m.value === selectedMonth)?.label || selectedMonth;

  // ─── PDF Export ────────────────────────────────────────────────────────────
  const exportToPDF = async () => {
    try {
      toast.loading('Gerando PDF...');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pw = pdf.internal.pageSize.getWidth();

      // Try logo
      try {
        const logoBlob = await fetch('/logo.png').then(r => r.blob());
        const logoUrl = await new Promise<string>((res) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
        pdf.addImage(logoUrl, 'PNG', 10, 8, 22, 22);
      } catch { /* skip */ }

      // Header
      pdf.setFontSize(16); pdf.setTextColor(30, 80, 200);
      pdf.text('Relatório Financeiro — Esteadeb', pw / 2, 16, { align: 'center' });
      pdf.setFontSize(10); pdf.setTextColor(100);
      pdf.text(`Período: ${monthLabel}`, pw / 2, 23, { align: 'center' });
      pdf.setFontSize(8);
      pdf.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, pw / 2, 28, { align: 'center' });

      // Line
      pdf.setDrawColor(30, 80, 200); pdf.setLineWidth(0.5);
      pdf.line(10, 32, pw - 10, 32);

      let y = 38;

      // Coordinator / Core info
      if (coordinators.length > 0) {
        const c = coordinators[0];
        pdf.setFontSize(9); pdf.setTextColor(30, 80, 200);
        pdf.text('▸  Informações do Núcleo', 10, y); y += 5;
        pdf.setTextColor(40);
        pdf.text(`Núcleo: ${c.nucleo || '—'}`, 14, y); y += 4;
        pdf.text(`Coordenador: ${c.nome || '—'}`, 14, y); y += 4;
        if (c.email || c.telefone) { pdf.text(`Contato: ${[c.email, c.telefone].filter(Boolean).join(' | ')}`, 14, y); y += 4; }
        y += 3;
      }

      // Chart
      if (chartRef.current) {
        const canvas = await html2canvas(chartRef.current, { scale: 2, useCORS: true });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, y, pw - 20, 48);
        y += 53;
      }

      // Financial Summary
      pdf.setFontSize(9); pdf.setTextColor(30, 80, 200);
      pdf.text('▸  Resumo Financeiro', 10, y); y += 5;
      pdf.setTextColor(40);

      const rows = [
        ['Dinheiro', `R$ ${summary.totalDinheiro.toFixed(2)}`],
        ['Pix / Depósito / Transferência', `R$ ${summary.totalPix.toFixed(2)}`],
        ['Cartão/Assinatura (bruto)', `R$ ${summary.totalCartaoAssinatura.toFixed(2)}`],
        ['  ↳ Líquido (-4% taxa)', `R$ ${summary.totalCartaoAssinaturaLiquido.toFixed(2)}`],
        ['Cartão Débito (bruto)', `R$ ${summary.totalCartaoDebito.toFixed(2)}`],
        ['  ↳ Líquido (-1,7% taxa)', `R$ ${summary.totalCartaoDebitoLiquido.toFixed(2)}`],
      ];
      rows.forEach(([label, val]) => {
        pdf.setTextColor(label.startsWith('  ') ? 180 : 40);
        pdf.text(label, 14, y);
        pdf.text(val, pw - 14, y, { align: 'right' });
        y += 4.5;
      });
      pdf.setTextColor(30, 80, 200); pdf.setFontSize(10);
      pdf.text(`Total Líquido: R$ ${summary.totalGeralLiquido.toFixed(2)}`, 14, y);
      y += 5; pdf.setTextColor(34, 150, 80); pdf.setFontSize(9);
      pdf.text(`Comissão Coordenação (12%): R$ ${summary.comissao.toFixed(2)}`, 14, y);
      y += 4; pdf.setTextColor(40);
      pdf.text(`Alunos pagos: ${summary.qtdAlunos}   |   Apostilas (total): ${summary.qtdApostilas} un.`, 14, y);
      y += 7;

      // Disciplines
      if (disciplines.length > 0) {
        if (y > 245) { pdf.addPage(); y = 20; }
        pdf.setFontSize(9); pdf.setTextColor(30, 80, 200);
        pdf.text('▸  Disciplinas e Professores', 10, y); y += 5;
        pdf.setFontSize(8); pdf.setTextColor(40);
        disciplines.forEach(d => {
          if (y > 280) { pdf.addPage(); y = 20; }
          pdf.text(`• ${d.nome || '—'} — Prof. ${d.professor || '—'}  (${[d.diasSemana, d.horario].filter(Boolean).join(' | ')})`, 14, y);
          y += 4.5;
        });
        y += 5;
      }

      // Students table
      if (y > 240) { pdf.addPage(); y = 20; }
      pdf.setFontSize(9); pdf.setTextColor(30, 80, 200);
      pdf.text('▸  Lista de Alunos', 10, y); y += 5;

      // Table header bg
      pdf.setFillColor(30, 80, 200);
      pdf.rect(10, y - 4, pw - 20, 6, 'F');
      pdf.setFontSize(7.5); pdf.setTextColor(255);
      pdf.text('Nº', 12, y); pdf.text('Nome', 24, y); pdf.text('Situação', 86, y);
      pdf.text('Dinheiro', 111, y); pdf.text('Pix/Trans', 132, y); pdf.text('C.Assina', 151, y); pdf.text('C.Débito', 169, y); pdf.text('Apost.', 188, y);
      y += 6; pdf.setTextColor(40);

      filteredStudents.forEach((s, i) => {
        if (y > 280) { pdf.addPage(); y = 20; }
        if (i % 2 === 0) { pdf.setFillColor(240, 245, 255); pdf.rect(10, y - 3.5, pw - 20, 5.5, 'F'); }
        pdf.setFontSize(7.5);
        pdf.text(String(s.numero ?? ''), 12, y);
        pdf.text(s.nome.substring(0, 26), 24, y);
        if (s.situacao === 'Pago') pdf.setTextColor(20, 140, 70);
        else if (s.situacao === 'Pendente') pdf.setTextColor(200, 30, 30);
        else pdf.setTextColor(150);
        pdf.text(s.situacao, 86, y);
        pdf.setTextColor(40);
        pdf.text(`R$ ${s.dinheiro.toFixed(2)}`, 111, y);
        pdf.text(`R$ ${s.pixTransferencia.toFixed(2)}`, 132, y);
        pdf.text(`R$ ${s.cartaoAssinatura.toFixed(2)}`, 151, y);
        pdf.text(`R$ ${s.cartaoDebito.toFixed(2)}`, 169, y);
        pdf.text(s.qtdApostilas > 0 ? String(s.qtdApostilas) : '—', 191, y);
        y += 5.5;
      });

      // Footer
      const pages = (pdf as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7); pdf.setTextColor(160);
        pdf.text(`Esteadeb — Sistema Financeiro  |  Página ${i} de ${pages}`, pw / 2, 292, { align: 'center' });
      }

      pdf.save(`Relatorio_Financeiro_${selectedMonth}.pdf`);
      toast.dismiss(); toast.success('PDF exportado com sucesso!');
    } catch (err) {
      toast.dismiss(); toast.error('Erro ao gerar PDF');
      console.error(err);
    }
  };

  // Nome do coordenador principal (fallback para Akson Pereira)
  const mainCoordinator = coordinators[0]?.nome?.trim() || 'Akson Pereira';
  const mainNucleo = coordinators[0]?.nucleo?.trim() || '';

  // ─── Render ────────────────────────────────────────────────────────────────
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'alunos', label: 'Alunos', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'coordenadores', label: 'Coordenadores', icon: <UserCog className="w-4 h-4" /> },
    { id: 'disciplinas', label: 'Disciplinas', icon: <BookOpen className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-border/80 bg-card/95 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src="/logo.png" alt="Esteadeb" className="h-10 w-10 object-contain" crossOrigin="anonymous" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">Sistema Financeiro</h1>
              <p className="text-xs text-muted-foreground">
                Coordenador: <span className="font-semibold text-primary">{mainCoordinator}</span>
                {mainNucleo && <span className="text-muted-foreground"> — {mainNucleo}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="flex-1 sm:w-52 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getMonthOptions().map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => { loadStudents(); loadCoordinators(); loadDisciplines(); }} title="Recarregar">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* ── Sidebar Navigation ── */}
        <aside className="lg:w-52 shrink-0">
          <nav className="lg:sticky lg:top-20 space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`sidebar-tab w-full text-left ${activeTab === tab.id ? 'active' : ''}`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </button>
            ))}

            <div className="pt-4 mt-4 border-t border-border space-y-2">
              <div className="px-4 py-3 rounded-xl bg-muted/50 space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Database className="w-3 h-3 text-emerald-500" /><span>Banco conectado</span></div>
                  <div className="flex items-center gap-1.5"><BarChart2 className="w-3 h-3 text-primary" /><span>{students.filter(s => s.mes === selectedMonth).length} alunos no mês</span></div>
                  <div className="pt-1 border-t border-border">
                    <p className="text-xs font-medium text-foreground/80">Coordenador:</p>
                    <p className="text-xs text-primary font-semibold">{mainCoordinator}</p>
                    {mainNucleo && <p className="text-xs text-muted-foreground">{mainNucleo}</p>}
                  </div>
                </div>
              </div>
            </div>
          </nav>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 min-w-0 space-y-5">

          {/* ════ ALUNOS TAB ════ */}
          {activeTab === 'alunos' && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Total Líquido', value: `R$ ${summary.totalGeralLiquido.toFixed(2)}`, icon: <DollarSign className="w-5 h-5" />, color: 'primary' },
                  { label: 'Comissão 12%', value: `R$ ${summary.comissao.toFixed(2)}`, icon: <Percent className="w-5 h-5" />, color: 'emerald' },
                  { label: 'Alunos Pagos', value: String(summary.qtdAlunos), icon: <Users className="w-5 h-5" />, color: 'blue' },
                  { label: 'Total Bruto', value: `R$ ${summary.totalGeral.toFixed(2)}`, icon: <TrendingUp className="w-5 h-5" />, color: 'violet' },
                ].map(card => (
                  <div key={card.label} className="stat-card bg-card border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
                      <div className={`p-1.5 rounded-lg bg-primary/10 text-primary`}>{card.icon}</div>
                    </div>
                    <p className="text-lg font-bold text-foreground truncate">{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Chart + Detail */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="tech-card p-5 lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-foreground text-sm">Arrecadação por Forma de Pagamento</h2>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">{monthLabel}</span>
                  </div>
                  <div ref={chartRef}>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `R$${v}`} />
                        <Tooltip
                          formatter={(v: number, n: string) => [`R$ ${v.toFixed(2)}`, n === 'valor' ? 'Bruto' : 'Líquido']}
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '10px', fontSize: 12 }}
                          cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="valor" fill="hsl(var(--primary))" opacity={0.35} name="Bruto" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="liquido" fill="hsl(var(--primary))" name="Líquido" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="tech-card p-5">
                  <h2 className="font-semibold text-foreground text-sm mb-4">Detalhamento</h2>
                  <div className="space-y-2.5 text-sm">
                    {[
                      { label: 'Dinheiro', val: summary.totalDinheiro },
                      { label: 'Pix/Transferência', val: summary.totalPix },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs">{item.label}</span>
                        <span className="font-semibold text-sm">R$ {item.val.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs">Cartão/Assinatura</span>
                        <span className="font-semibold text-sm">R$ {summary.totalCartaoAssinatura.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-red-500 ml-3">
                        <span>-4% taxa</span>
                        <span>R$ {summary.totalCartaoAssinaturaLiquido.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs">Cartão Débito</span>
                        <span className="font-semibold text-sm">R$ {summary.totalCartaoDebito.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-red-500 ml-3">
                        <span>-1,7% taxa</span>
                        <span>R$ {summary.totalCartaoDebitoLiquido.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="border-t pt-3 mt-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-primary text-sm">Total Líquido</span>
                        <span className="font-bold text-primary">R$ {summary.totalGeralLiquido.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-700 dark:text-emerald-400 text-xs font-semibold">Comissão (12%)</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">R$ {summary.comissao.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Total de apostilas</span>
                      <span className="font-bold text-primary">{summary.qtdApostilas} un.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Controls */}
              <div className="tech-card p-5">
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9" />
                  </div>
                  <Select value={filterSituacao} onValueChange={setFilterSituacao}>
                    <SelectTrigger className="w-full sm:w-40 h-9">
                      <SelectValue placeholder="Situação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="Pago">Pago</SelectItem>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addStudent} className="gap-1.5 h-9 flex-1 sm:flex-initial">
                      <Plus className="w-4 h-4" />Adicionar
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportToPDF} className="gap-1.5 h-9 flex-1 sm:flex-initial">
                      <Download className="w-4 h-4" />PDF
                    </Button>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-border rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        {['Nº', 'Matrícula', 'Nome', 'Dinheiro', 'Pix/Trans', 'Cartão/Ass.', 'Cartão Déb.', 'Situação', 'Apostilas?', 'Qtd. Apost.', 'Obs', ''].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap first:pl-4 last:pr-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loadingStudents ? (
                        <tr><td colSpan={12} className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /><p className="text-xs">Carregando dados...</p></td></tr>
                      ) : filteredStudents.length === 0 ? (
                        <tr><td colSpan={12} className="text-center py-10">
                          <GraduationCap className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Nenhum registro. Clique em "Adicionar".</p>
                        </td></tr>
                      ) : filteredStudents.map((s, idx) => (
                        <tr key={s.id} className={`border-b border-border/50 transition-colors hover:bg-muted/20 ${idx % 2 === 1 ? 'bg-muted/10' : ''}`}>
                          <td className="pl-4 py-2 text-xs text-muted-foreground font-mono font-semibold">
                            <div className="flex items-center gap-1">
                              {s.numero}
                              {savingIds.has(s.id) && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 min-w-[100px]">
                            <Input value={s.matricula} onChange={e => updateStudent(s.id, 'matricula', e.target.value)} className="table-cell-input" placeholder="—" />
                          </td>
                          <td className="px-2 py-1.5 min-w-[160px]">
                            <Input value={s.nome} onChange={e => updateStudent(s.id, 'nome', e.target.value)} className="table-cell-input" placeholder="Nome completo" />
                          </td>
                          {(['dinheiro', 'pixTransferencia', 'cartaoAssinatura', 'cartaoDebito'] as const).map(field => (
                            <td key={field} className="px-2 py-1.5 min-w-[100px]">
                              <Input type="number" value={s[field] as number} onChange={e => updateStudent(s.id, field, parseFloat(e.target.value) || 0)} className="table-cell-input" step="0.01" placeholder="0.00" />
                            </td>
                          ))}
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {s.situacao === 'Pago' ? (
                              <span className="badge-pago"><CheckCircle className="w-3 h-3" />Pago</span>
                            ) : s.situacao === 'Pendente' ? (
                              <span className="badge-pendente"><Clock className="w-3 h-3" />Pendente</span>
                            ) : (
                              <span className="badge-neutro">—</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 min-w-[90px]">
                            <Select value={s.apostilas} onValueChange={v => {
                              updateStudent(s.id, 'apostilas', v);
                              if (v === 'Não') updateStudent(s.id, 'qtdApostilas', 0);
                            }}>
                              <SelectTrigger className="h-8 text-xs border-0 bg-transparent focus:bg-background focus:ring-1 focus:ring-primary/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Sim">Sim</SelectItem>
                                <SelectItem value="Não">Não</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-1.5 min-w-[80px]">
                            <Input
                              type="number"
                              min={0}
                              value={s.qtdApostilas}
                              onChange={e => {
                                const qty = parseInt(e.target.value) || 0;
                                updateStudent(s.id, 'qtdApostilas', qty);
                                if (qty > 0 && s.apostilas !== 'Sim') updateStudent(s.id, 'apostilas', 'Sim');
                                if (qty === 0 && s.apostilas === 'Sim') updateStudent(s.id, 'apostilas', 'Não');
                              }}
                              className="table-cell-input"
                              placeholder="0"
                              disabled={s.apostilas === 'Não'}
                            />
                          </td>
                          <td className="px-2 py-1.5 min-w-[140px]">
                            <Input value={s.obs} onChange={e => updateStudent(s.id, 'obs', e.target.value)} className="table-cell-input" placeholder="Observações..." />
                          </td>
                          <td className="pr-4 py-1.5">
                            <Button variant="ghost" size="sm" onClick={() => deleteStudent(s.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                  <span>{filteredStudents.length} registro(s) • {monthLabel}</span>
                  <span className="flex items-center gap-1"><Database className="w-3 h-3 text-emerald-500" />Sincronizado com banco de dados</span>
                </div>
              </div>
            </>
          )}

          {/* ════ COORDENADORES TAB ════ */}
          {activeTab === 'coordenadores' && (
            <div className="tech-card p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold text-foreground">Coordenadores do Núcleo</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Responsáveis pela gestão e coordenação</p>
                </div>
                <Button size="sm" onClick={addCoordinator} className="gap-1.5 h-9">
                  <Plus className="w-4 h-4" />Adicionar
                </Button>
              </div>

              <div className="border border-border rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      {['Nº', 'Nome', 'Email', 'Telefone', 'Núcleo', 'Data Início', ''].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loadingCoords ? (
                      <tr><td colSpan={7} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                    ) : coordinators.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">Nenhum coordenador cadastrado.</td></tr>
                    ) : coordinators.map((c, idx) => (
                      <tr key={c.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${idx % 2 === 1 ? 'bg-muted/10' : ''}`}>
                        <td className="pl-4 py-2 text-xs text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="px-2 py-1.5 min-w-[180px]"><Input value={c.nome} onChange={e => updateCoordinator(c.id, 'nome', e.target.value)} className="table-cell-input" placeholder="Nome completo" /></td>
                        <td className="px-2 py-1.5 min-w-[180px]"><Input type="email" value={c.email} onChange={e => updateCoordinator(c.id, 'email', e.target.value)} className="table-cell-input" placeholder="email@exemplo.com" /></td>
                        <td className="px-2 py-1.5 min-w-[130px]"><Input value={c.telefone} onChange={e => updateCoordinator(c.id, 'telefone', e.target.value)} className="table-cell-input" placeholder="(00) 00000-0000" /></td>
                        <td className="px-2 py-1.5 min-w-[160px]"><Input value={c.nucleo} onChange={e => updateCoordinator(c.id, 'nucleo', e.target.value)} className="table-cell-input" placeholder="Nome do núcleo" /></td>
                        <td className="px-2 py-1.5 min-w-[130px]"><Input type="date" value={c.dataInicio} onChange={e => updateCoordinator(c.id, 'dataInicio', e.target.value)} className="table-cell-input" /></td>
                        <td className="pr-4 py-1.5">
                          <Button variant="ghost" size="sm" onClick={() => deleteCoordinator(c.id)} className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════ DISCIPLINAS TAB ════ */}
          {activeTab === 'disciplinas' && (
            <div className="tech-card p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold text-foreground">Disciplinas e Professores</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Grade curricular e responsáveis</p>
                </div>
                <Button size="sm" onClick={addDiscipline} className="gap-1.5 h-9">
                  <Plus className="w-4 h-4" />Adicionar
                </Button>
              </div>

              <div className="border border-border rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      {['Nº', 'Disciplina', 'Professor Responsável', 'Carga Horária', 'Dias da Semana', 'Horário', ''].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loadingDiscs ? (
                      <tr><td colSpan={7} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                    ) : disciplines.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">Nenhuma disciplina cadastrada.</td></tr>
                    ) : disciplines.map((d, idx) => (
                      <tr key={d.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${idx % 2 === 1 ? 'bg-muted/10' : ''}`}>
                        <td className="pl-4 py-2 text-xs text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="px-2 py-1.5 min-w-[160px]"><Input value={d.nome} onChange={e => updateDiscipline(d.id, 'nome', e.target.value)} className="table-cell-input" placeholder="Nome da disciplina" /></td>
                        <td className="px-2 py-1.5 min-w-[180px]"><Input value={d.professor} onChange={e => updateDiscipline(d.id, 'professor', e.target.value)} className="table-cell-input" placeholder="Nome do professor" /></td>
                        <td className="px-2 py-1.5 min-w-[110px]"><Input type="number" value={d.cargaHoraria} onChange={e => updateDiscipline(d.id, 'cargaHoraria', parseInt(e.target.value) || 0)} className="table-cell-input" placeholder="0h" /></td>
                        <td className="px-2 py-1.5 min-w-[160px]"><Input value={d.diasSemana} onChange={e => updateDiscipline(d.id, 'diasSemana', e.target.value)} className="table-cell-input" placeholder="Seg, Qua, Sex" /></td>
                        <td className="px-2 py-1.5 min-w-[130px]"><Input value={d.horario} onChange={e => updateDiscipline(d.id, 'horario', e.target.value)} className="table-cell-input" placeholder="19:00–21:00" /></td>
                        <td className="pr-4 py-1.5">
                          <Button variant="ghost" size="sm" onClick={() => deleteDiscipline(d.id)} className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
