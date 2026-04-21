import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Student, Coordinator, Discipline, FinancialSummary, TAXA_CARTAO_ASSINATURA, TAXA_CARTAO_DEBITO, TAXA_COMISSAO } from '@/types/student';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Plus, Search, Download, Trash2, TrendingUp, DollarSign, Percent, Users, UserCog, BookOpen, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const Dashboard = () => {
  const { logout } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSituacao, setFilterSituacao] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const chartRef = useRef<HTMLDivElement>(null);

  // Load data
  useEffect(() => {
    const savedStudents = localStorage.getItem('students');
    const savedCoordinators = localStorage.getItem('coordinators');
    const savedDisciplines = localStorage.getItem('disciplines');
    
    if (savedStudents) setStudents(JSON.parse(savedStudents));
    if (savedCoordinators) setCoordinators(JSON.parse(savedCoordinators));
    if (savedDisciplines) setDisciplines(JSON.parse(savedDisciplines));
  }, []);

  // Save data
  useEffect(() => {
    localStorage.setItem('students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('coordinators', JSON.stringify(coordinators));
  }, [coordinators]);

  useEffect(() => {
    localStorage.setItem('disciplines', JSON.stringify(disciplines));
  }, [disciplines]);

  // Generate month options (last 12 months + next 6 months)
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

  const calculateSituacao = (student: Partial<Student>): 'Pago' | 'Pendente' | '-' => {
    if (!student.nome) return '-';
    const totalPagamento =
      (student.dinheiro || 0) +
      (student.pixTransferencia || 0) +
      (student.cartaoAssinatura || 0) +
      (student.cartaoDebito || 0);
    return totalPagamento > 0 ? 'Pago' : 'Pendente';
  };

  // STUDENTS
  const addStudent = () => {
    const newStudent: Student = {
      id: students.length > 0 ? Math.max(...students.map((s) => s.id)) + 1 : 1,
      matricula: '',
      nome: '',
      dinheiro: 0,
      pixTransferencia: 0,
      cartaoAssinatura: 0,
      cartaoDebito: 0,
      situacao: '-',
      apostilas: 'Não',
      obs: '',
      mes: selectedMonth,
    };
    setStudents([...students, newStudent]);
    toast.success('Novo aluno adicionado');
  };

  const updateStudent = (id: number, field: keyof Student, value: string | number) => {
    setStudents((prev) =>
      prev.map((student) => {
        if (student.id === id) {
          const updated = { ...student, [field]: value };
          updated.situacao = calculateSituacao(updated);
          return updated;
        }
        return student;
      })
    );
  };

  const deleteStudent = (id: number) => {
    setStudents((prev) => prev.filter((student) => student.id !== id));
    toast.success('Aluno excluído');
  };

  // COORDINATORS
  const addCoordinator = () => {
    const newCoordinator: Coordinator = {
      id: coordinators.length > 0 ? Math.max(...coordinators.map((c) => c.id)) + 1 : 1,
      nome: '',
      email: '',
      telefone: '',
      nucleo: '',
      dataInicio: new Date().toISOString().split('T')[0],
    };
    setCoordinators([...coordinators, newCoordinator]);
    toast.success('Novo coordenador adicionado');
  };

  const updateCoordinator = (id: number, field: keyof Coordinator, value: string) => {
    setCoordinators((prev) =>
      prev.map((coordinator) =>
        coordinator.id === id ? { ...coordinator, [field]: value } : coordinator
      )
    );
  };

  const deleteCoordinator = (id: number) => {
    setCoordinators((prev) => prev.filter((coordinator) => coordinator.id !== id));
    toast.success('Coordenador excluído');
  };

  // DISCIPLINES
  const addDiscipline = () => {
    const newDiscipline: Discipline = {
      id: disciplines.length > 0 ? Math.max(...disciplines.map((d) => d.id)) + 1 : 1,
      nome: '',
      professor: '',
      cargaHoraria: 0,
      diasSemana: '',
      horario: '',
    };
    setDisciplines([...disciplines, newDiscipline]);
    toast.success('Nova disciplina adicionada');
  };

  const updateDiscipline = (id: number, field: keyof Discipline, value: string | number) => {
    setDisciplines((prev) =>
      prev.map((discipline) =>
        discipline.id === id ? { ...discipline, [field]: value } : discipline
      )
    );
  };

  const deleteDiscipline = (id: number) => {
    setDisciplines((prev) => prev.filter((discipline) => discipline.id !== id));
    toast.success('Disciplina excluída');
  };

  // Filter students by month
  const filteredStudents = students.filter((student) => {
    const matchesMonth = student.mes === selectedMonth;
    const matchesSearch = student.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSituacao = filterSituacao === 'all' || student.situacao === filterSituacao;
    return matchesMonth && matchesSearch && matchesSituacao;
  });

  const getFinancialSummary = (): FinancialSummary => {
    const monthStudents = students.filter(s => s.mes === selectedMonth);
    const totals = monthStudents.reduce(
      (acc, student) => {
        acc.dinheiro += student.dinheiro;
        acc.pixTransferencia += student.pixTransferencia;
        acc.cartaoAssinatura += student.cartaoAssinatura;
        acc.cartaoDebito += student.cartaoDebito;
        if (student.apostilas === 'Sim') acc.apostilas += 1;
        return acc;
      },
      { dinheiro: 0, pixTransferencia: 0, cartaoAssinatura: 0, cartaoDebito: 0, apostilas: 0 }
    );

    const cartaoAssinaturaLiquido = totals.cartaoAssinatura * (1 - TAXA_CARTAO_ASSINATURA);
    const cartaoDebitoLiquido = totals.cartaoDebito * (1 - TAXA_CARTAO_DEBITO);
    
    const totalGeral = totals.dinheiro + totals.pixTransferencia + totals.cartaoAssinatura + totals.cartaoDebito;
    const totalGeralLiquido = totals.dinheiro + totals.pixTransferencia + cartaoAssinaturaLiquido + cartaoDebitoLiquido;
    
    const comissao = totalGeralLiquido * TAXA_COMISSAO;
    
    const qtdAlunos = monthStudents.filter(s => s.situacao === 'Pago').length;

    return {
      totalDinheiro: totals.dinheiro,
      totalPix: totals.pixTransferencia,
      totalCartaoAssinatura: totals.cartaoAssinatura,
      totalCartaoAssinaturaLiquido: cartaoAssinaturaLiquido,
      totalCartaoDebito: totals.cartaoDebito,
      totalCartaoDebitoLiquido: cartaoDebitoLiquido,
      totalGeral,
      totalGeralLiquido,
      comissao,
      qtdAlunos,
      qtdApostilas: totals.apostilas,
    };
  };

  const summary = getFinancialSummary();

  const getChartData = () => {
    return [
      { name: 'Dinheiro', valor: summary.totalDinheiro, liquido: summary.totalDinheiro },
      { name: 'Pix/Transfer', valor: summary.totalPix, liquido: summary.totalPix },
      { name: 'Cartão/Assina', valor: summary.totalCartaoAssinatura, liquido: summary.totalCartaoAssinaturaLiquido },
      { name: 'Cartão Débito', valor: summary.totalCartaoDebito, liquido: summary.totalCartaoDebitoLiquido },
    ];
  };

  const exportToPDF = async () => {
    try {
      toast.loading('Gerando PDF...');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const monthLabel = getMonthOptions().find(m => m.value === selectedMonth)?.label || selectedMonth;
      
      // Header
      pdf.setFontSize(18);
      pdf.setTextColor(59, 130, 246);
      pdf.text('Relatório Financeiro - Controle de Alunos', pageWidth / 2, 15, { align: 'center' });
      
      pdf.setFontSize(11);
      pdf.setTextColor(100);
      pdf.text(`Período: ${monthLabel}`, pageWidth / 2, 22, { align: 'center' });
      pdf.setFontSize(9);
      pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 27, { align: 'center' });

      // Capture chart
      if (chartRef.current) {
        const canvas = await html2canvas(chartRef.current, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 10, 32, pageWidth - 20, 55);
      }

      // Financial Summary
      pdf.setFontSize(12);
      pdf.setTextColor(0);
      pdf.text('Resumo Financeiro', 10, 95);
      
      pdf.setFontSize(9);
      let yPos = 102;
      
      pdf.text(`Dinheiro: R$ ${summary.totalDinheiro.toFixed(2)}`, 15, yPos);
      yPos += 5;
      pdf.text(`Pix/Depósito/Transferência: R$ ${summary.totalPix.toFixed(2)}`, 15, yPos);
      yPos += 5;
      pdf.text(`Cartão/Assinatura (bruto): R$ ${summary.totalCartaoAssinatura.toFixed(2)}`, 15, yPos);
      yPos += 5;
      pdf.setTextColor(220, 38, 38);
      pdf.text(`Cartão/Assinatura (-4% taxa): R$ ${summary.totalCartaoAssinaturaLiquido.toFixed(2)}`, 15, yPos);
      pdf.setTextColor(0);
      yPos += 5;
      pdf.text(`Cartão Débito (bruto): R$ ${summary.totalCartaoDebito.toFixed(2)}`, 15, yPos);
      yPos += 5;
      pdf.setTextColor(220, 38, 38);
      pdf.text(`Cartão Débito (-1,7% taxa): R$ ${summary.totalCartaoDebitoLiquido.toFixed(2)}`, 15, yPos);
      pdf.setTextColor(0);
      yPos += 7;
      
      pdf.setFontSize(11);
      pdf.setTextColor(59, 130, 246);
      pdf.text(`Total Geral (Líquido): R$ ${summary.totalGeralLiquido.toFixed(2)}`, 15, yPos);
      yPos += 6;
      pdf.setTextColor(34, 197, 94);
      pdf.text(`Comissão Coordenação (12%): R$ ${summary.comissao.toFixed(2)}`, 15, yPos);
      yPos += 6;
      pdf.setTextColor(0);
      pdf.text(`Alunos Matriculados: ${summary.qtdAlunos}`, 15, yPos);
      yPos += 6;
      pdf.text(`Apostilas: ${summary.qtdApostilas}`, 15, yPos);

      // Table
      yPos += 10;
      pdf.setFontSize(12);
      pdf.text('Lista de Alunos', 10, yPos);
      
      yPos += 7;
      pdf.setFontSize(8);
      
      // Table header
      pdf.setFillColor(59, 130, 246);
      pdf.setTextColor(255);
      pdf.rect(10, yPos - 4, pageWidth - 20, 6, 'F');
      pdf.text('Nº', 12, yPos);
      pdf.text('Nome', 25, yPos);
      pdf.text('Situação', 90, yPos);
      pdf.text('Dinheiro', 115, yPos);
      pdf.text('Pix/Trans', 140, yPos);
      pdf.text('Cartão', 165, yPos);
      pdf.text('Débito', 185, yPos);
      
      yPos += 7;
      
      // Table rows
      pdf.setTextColor(0);
      filteredStudents.forEach((student) => {
        if (yPos > 280) {
          pdf.addPage();
          yPos = 20;
        }
        
        pdf.text(student.id.toString(), 12, yPos);
        pdf.text(student.nome.substring(0, 30), 25, yPos);
        pdf.text(student.situacao, 90, yPos);
        pdf.text(`R$ ${student.dinheiro.toFixed(2)}`, 115, yPos);
        pdf.text(`R$ ${student.pixTransferencia.toFixed(2)}`, 140, yPos);
        pdf.text(`R$ ${student.cartaoAssinatura.toFixed(2)}`, 165, yPos);
        pdf.text(`R$ ${student.cartaoDebito.toFixed(2)}`, 185, yPos);
        
        yPos += 6;
      });

      pdf.save(`Relatorio_Financeiro_${selectedMonth}.pdf`);
      toast.dismiss();
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      toast.dismiss();
      toast.error('Erro ao gerar PDF');
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/30 to-background">
      {/* Header */}
      <header className="bg-card border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Sistema Financeiro</h1>
              <p className="text-sm text-muted-foreground">Controle Completo de Gestão</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 flex-1 md:flex-initial">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getMonthOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={logout} className="gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <Tabs defaultValue="alunos" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="alunos" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Alunos</span>
            </TabsTrigger>
            <TabsTrigger value="coordenadores" className="gap-2">
              <UserCog className="w-4 h-4" />
              <span className="hidden sm:inline">Coordenadores</span>
            </TabsTrigger>
            <TabsTrigger value="disciplinas" className="gap-2">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Disciplinas</span>
            </TabsTrigger>
          </TabsList>

          {/* ALUNOS TAB */}
          <TabsContent value="alunos" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Total Líquido</p>
                    <p className="text-xl lg:text-2xl font-bold text-primary truncate">
                      R$ {summary.totalGeralLiquido.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                    <Percent className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Comissão (12%)</p>
                    <p className="text-xl lg:text-2xl font-bold text-green-600 truncate">
                      R$ {summary.comissao.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Alunos Pagos</p>
                    <p className="text-xl lg:text-2xl font-bold text-blue-600">
                      {summary.qtdAlunos}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Total Bruto</p>
                    <p className="text-xl lg:text-2xl font-bold text-purple-600 truncate">
                      R$ {summary.totalGeral.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Chart and Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-6 lg:col-span-2">
                <h2 className="text-xl font-bold text-foreground mb-4">Arrecadação por Forma de Pagamento</h2>
                <div ref={chartRef}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getChartData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `R$ ${value.toFixed(2)}`,
                          name === 'valor' ? 'Bruto' : 'Líquido'
                        ]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Bar dataKey="valor" fill="hsl(var(--primary))" name="Bruto" opacity={0.6} />
                      <Bar dataKey="liquido" fill="hsl(var(--primary))" name="Líquido" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="text-xl font-bold text-foreground mb-4">Detalhamento</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dinheiro:</span>
                    <span className="font-semibold">R$ {summary.totalDinheiro.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pix/Transferência:</span>
                    <span className="font-semibold">R$ {summary.totalPix.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cartão/Assinatura:</span>
                      <span className="font-semibold">R$ {summary.totalCartaoAssinatura.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-red-600 dark:text-red-400 ml-4">
                      <span>(-4% taxa):</span>
                      <span>R$ {summary.totalCartaoAssinaturaLiquido.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cartão Débito:</span>
                      <span className="font-semibold">R$ {summary.totalCartaoDebito.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-red-600 dark:text-red-400 ml-4">
                      <span>(-1,7% taxa):</span>
                      <span>R$ {summary.totalCartaoDebitoLiquido.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between text-base">
                      <span className="font-semibold text-primary">Total Líquido:</span>
                      <span className="font-bold text-primary">R$ {summary.totalGeralLiquido.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="border-t pt-3 mt-3 bg-green-50 dark:bg-green-950/20 -mx-6 px-6 py-3 rounded-lg">
                    <div className="flex justify-between">
                      <span className="font-semibold text-green-700 dark:text-green-400">Comissão (12%):</span>
                      <span className="font-bold text-green-700 dark:text-green-400">R$ {summary.comissao.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Apostilas:</span>
                      <span className="font-semibold">{summary.qtdApostilas}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Controls */}
            <Card className="p-6">
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterSituacao} onValueChange={setFilterSituacao}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Filtrar situação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="Pago">Pago</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button onClick={addStudent} className="gap-2 flex-1 md:flex-initial">
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </Button>
                  <Button onClick={exportToPDF} variant="outline" className="gap-2 flex-1 md:flex-initial">
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">PDF</span>
                  </Button>
                </div>
              </div>

              {/* Table */}
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16">Nº</TableHead>
                      <TableHead className="min-w-32">Matrícula</TableHead>
                      <TableHead className="min-w-48">Nome</TableHead>
                      <TableHead className="min-w-32">Dinheiro</TableHead>
                      <TableHead className="min-w-40">Pix/Transfer</TableHead>
                      <TableHead className="min-w-40">Cartão/Assina</TableHead>
                      <TableHead className="min-w-32">Cartão Déb</TableHead>
                      <TableHead className="w-28">Situação</TableHead>
                      <TableHead className="w-32">Apostilas?</TableHead>
                      <TableHead className="min-w-48">Obs</TableHead>
                      <TableHead className="w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.id}</TableCell>
                        <TableCell>
                          <Input
                            value={student.matricula}
                            onChange={(e) => updateStudent(student.id, 'matricula', e.target.value)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={student.nome}
                            onChange={(e) => updateStudent(student.id, 'nome', e.target.value)}
                            className="h-8"
                            required
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={student.dinheiro}
                            onChange={(e) =>
                              updateStudent(student.id, 'dinheiro', parseFloat(e.target.value) || 0)
                            }
                            className="h-8"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={student.pixTransferencia}
                            onChange={(e) =>
                              updateStudent(
                                student.id,
                                'pixTransferencia',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-8"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={student.cartaoAssinatura}
                            onChange={(e) =>
                              updateStudent(
                                student.id,
                                'cartaoAssinatura',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-8"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={student.cartaoDebito}
                            onChange={(e) =>
                              updateStudent(
                                student.id,
                                'cartaoDebito',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-8"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                              student.situacao === 'Pago'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : student.situacao === 'Pendente'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                            }`}
                          >
                            {student.situacao}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={student.apostilas}
                            onValueChange={(value) => updateStudent(student.id, 'apostilas', value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Sim">Sim</SelectItem>
                              <SelectItem value="Não">Não</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={student.obs}
                            onChange={(e) => updateStudent(student.id, 'obs', e.target.value)}
                            className="h-8"
                            placeholder="Observações..."
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteStudent(student.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredStudents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                          Nenhum registro encontrado para este mês. Clique em "Adicionar" para começar.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* COORDENADORES TAB */}
          <TabsContent value="coordenadores" className="space-y-6">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-foreground">Coordenadores do Núcleo</h2>
                <Button onClick={addCoordinator} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar
                </Button>
              </div>

              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16">Nº</TableHead>
                      <TableHead className="min-w-48">Nome</TableHead>
                      <TableHead className="min-w-48">Email</TableHead>
                      <TableHead className="min-w-32">Telefone</TableHead>
                      <TableHead className="min-w-48">Núcleo</TableHead>
                      <TableHead className="min-w-32">Data Início</TableHead>
                      <TableHead className="w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coordinators.map((coordinator) => (
                      <TableRow key={coordinator.id}>
                        <TableCell className="font-medium">{coordinator.id}</TableCell>
                        <TableCell>
                          <Input
                            value={coordinator.nome}
                            onChange={(e) => updateCoordinator(coordinator.id, 'nome', e.target.value)}
                            className="h-8"
                            placeholder="Nome completo"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="email"
                            value={coordinator.email}
                            onChange={(e) => updateCoordinator(coordinator.id, 'email', e.target.value)}
                            className="h-8"
                            placeholder="email@exemplo.com"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={coordinator.telefone}
                            onChange={(e) => updateCoordinator(coordinator.id, 'telefone', e.target.value)}
                            className="h-8"
                            placeholder="(00) 00000-0000"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={coordinator.nucleo}
                            onChange={(e) => updateCoordinator(coordinator.id, 'nucleo', e.target.value)}
                            className="h-8"
                            placeholder="Nome do núcleo"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={coordinator.dataInicio}
                            onChange={(e) => updateCoordinator(coordinator.id, 'dataInicio', e.target.value)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCoordinator(coordinator.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {coordinators.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum coordenador cadastrado. Clique em "Adicionar" para começar.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* DISCIPLINAS TAB */}
          <TabsContent value="disciplinas" className="space-y-6">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-foreground">Disciplinas e Professores</h2>
                <Button onClick={addDiscipline} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar
                </Button>
              </div>

              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16">Nº</TableHead>
                      <TableHead className="min-w-48">Disciplina</TableHead>
                      <TableHead className="min-w-48">Professor Responsável</TableHead>
                      <TableHead className="min-w-32">Carga Horária</TableHead>
                      <TableHead className="min-w-40">Dias da Semana</TableHead>
                      <TableHead className="min-w-32">Horário</TableHead>
                      <TableHead className="w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disciplines.map((discipline) => (
                      <TableRow key={discipline.id}>
                        <TableCell className="font-medium">{discipline.id}</TableCell>
                        <TableCell>
                          <Input
                            value={discipline.nome}
                            onChange={(e) => updateDiscipline(discipline.id, 'nome', e.target.value)}
                            className="h-8"
                            placeholder="Nome da disciplina"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={discipline.professor}
                            onChange={(e) => updateDiscipline(discipline.id, 'professor', e.target.value)}
                            className="h-8"
                            placeholder="Nome do professor"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={discipline.cargaHoraria}
                            onChange={(e) =>
                              updateDiscipline(discipline.id, 'cargaHoraria', parseInt(e.target.value) || 0)
                            }
                            className="h-8"
                            placeholder="Horas"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={discipline.diasSemana}
                            onChange={(e) => updateDiscipline(discipline.id, 'diasSemana', e.target.value)}
                            className="h-8"
                            placeholder="Ex: Seg, Qua, Sex"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={discipline.horario}
                            onChange={(e) => updateDiscipline(discipline.id, 'horario', e.target.value)}
                            className="h-8"
                            placeholder="Ex: 19:00 - 21:00"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteDiscipline(discipline.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {disciplines.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhuma disciplina cadastrada. Clique em "Adicionar" para começar.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
