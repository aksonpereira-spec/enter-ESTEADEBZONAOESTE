export type Turno = 'Manhã' | 'Tarde' | 'Noite';
export type SituacaoPagamento = 'Pago' | 'Pendente';

export interface Turma {
  id: string;
  nome: string;
  turno: Turno;
  disciplina: string;
  professor: string;
  diasSemana: string;
  nucleo: string;
  honorario: number;
  createdAt: string;
}

export interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  telefone: string;
  email: string;
  turmaId: string | null;
  turma?: Turma;
  ativo: boolean;
  createdAt: string;
}

export interface Mensalidade {
  id: string;
  alunoId: string;
  aluno?: Aluno;
  turmaId: string | null;
  mes: string;
  situacao: SituacaoPagamento;
  dinheiro: number;
  pixDeposito: number;
  cartaoAssinatura: number;
  cartaoDebito: number;
  valor: number; // total = sum of the 4 above
  obs: string;
  apostilas: 'Sim' | 'Não';
  qtdApostilas: number;
}

export interface AttendanceSession {
  id: string;
  turmaId: string;
  turma?: Turma;
  data: string;
  turno: Turno;
  professor: string;
  disciplina: string;
  obs: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  alunoId: string;
  aluno?: Aluno;
  presente: boolean;
}
