import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Student, PaymentType } from '@/types/student';
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
import { LogOut, Plus, Search, Download, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const Dashboard = () => {
  const { logout } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSituacao, setFilterSituacao] = useState<string>('all');
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedStudents = localStorage.getItem('students');
    if (savedStudents) {
      setStudents(JSON.parse(savedStudents));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('students', JSON.stringify(students));
  }, [students]);

  const calculateSituacao = (student: Partial<Student>): 'Pago' | 'Pendente' | '-' => {
    if (!student.nome) return '-';
    const totalPagamento =
      (student.dinheiro || 0) +
      (student.pixTransferencia || 0) +
      (student.cartaoAssinatura || 0) +
      (student.cartaoDebito || 0);
    return totalPagamento > 0 ? 'Pago' : 'Pendente';
  };

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
    };
    setStudents([...students, newStudent]);
    toast.success('Novo registro adicionado');
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
    toast.success('Registro excluído');
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch = student.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSituacao =
      filterSituacao === 'all' || student.situacao === filterSituacao;
    return matchesSearch && matchesSituacao;
  });

  const getChartData = () => {
    const totals = students.reduce(
      (acc, student) => {
        acc.dinheiro += student.dinheiro;
        acc.pixTransferencia += student.pixTransferencia;
        acc.cartaoAssinatura += student.cartaoAssinatura;
        acc.cartaoDebito += student.cartaoDebito;
        return acc;
      },
      { dinheiro: 0, pixTransferencia: 0, cartaoAssinatura: 0, cartaoDebito: 0 }
    );

    return [
      { name: 'Dinheiro', valor: totals.dinheiro },
      { name: 'Pix/Transfer', valor: totals.pixTransferencia },
      { name: 'Cartão/Assina', valor: totals.cartaoAssinatura },
      { name: 'Cartão Débito', valor: totals.cartaoDebito },
    ];
  };

  const getTotalArrecadado = () => {
    return students.reduce(
      (acc, student) =>
        acc +
        student.dinheiro +
        student.pixTransferencia +
        student.cartaoAssinatura +
        student.cartaoDebito,
      0
    );
  };

  const exportToPDF = async () => {
    try {
      toast.loading('Gerando PDF...');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      // Header
      pdf.setFontSize(18);
      pdf.setTextColor(59, 130, 246);
      pdf.text('Relatório Financeiro - Alunos', pageWidth / 2, 15, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, 22, { align: 'center' });

      // Capture chart
      if (chartRef.current) {
        const canvas = await html2canvas(chartRef.current, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 10, 28, pageWidth - 20, 60);
      }

      // Summary
      const totalArrecadado = getTotalArrecadado();
      const chartData = getChartData();
      
      pdf.setFontSize(12);
      pdf.setTextColor(0);
      pdf.text('Resumo Financeiro', 10, 95);
      
      pdf.setFontSize(10);
      let yPos = 102;
      chartData.forEach((item) => {
        pdf.text(`${item.name}: R$ ${item.valor.toFixed(2)}`, 15, yPos);
        yPos += 6;
      });
      
      pdf.setFontSize(11);
      pdf.setTextColor(59, 130, 246);
      pdf.text(`Total Arrecadado: R$ ${totalArrecadado.toFixed(2)}`, 15, yPos + 3);

      // Table
      yPos += 12;
      pdf.setFontSize(12);
      pdf.setTextColor(0);
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
      filteredStudents.forEach((student, index) => {
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

      pdf.save('Relatorio_Financeiro_Alunos.pdf');
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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Sistema Financeiro</h1>
              <p className="text-sm text-muted-foreground">Controle de Alunos</p>
            </div>
          </div>
          <Button variant="outline" onClick={logout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Chart */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Arrecadação Total</h2>
              <p className="text-3xl font-bold text-primary mt-2">
                R$ {getTotalArrecadado().toFixed(2)}
              </p>
            </div>
          </div>
          <div ref={chartRef}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar dataKey="valor" fill="hsl(var(--primary))" name="Valor Arrecadado" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

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
              <Button onClick={addStudent} className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
              <Button onClick={exportToPDF} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Exportar PDF
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
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
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
                      Nenhum registro encontrado. Clique em "Adicionar" para começar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
