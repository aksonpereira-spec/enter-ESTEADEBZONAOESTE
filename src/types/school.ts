export type Turno = 'Manhã' | 'Tarde' | 'Noite';
export type SituacaoPagamento = 'Pago' | 'Pendente';
export type FormaPagamento = 'Dinheiro' | 'Pix/Transferência' | 'Cartão Crédito' | 'Cartão Débito' | '';

export interface Turma {
  id: string;
  nome: string;
  turno: Turno;
  disciplina: string;
  professor: string;
  diasSemana: string;
  nucleo: string;
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
  formaPagamento: FormaPagamento;
  valor: number;
  obs: string;
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
