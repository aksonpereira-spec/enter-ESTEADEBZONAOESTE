export type Turno = 'Manhã' | 'Tarde' | 'Noite';
export type SituacaoPagamento = 'Pago' | 'Pendente';
export type TipoBolsa = '' | 'Coordenador' | 'Esposa do Coordenador' | 'Bolsista' | 'Bolsista Parcial';

export interface NucleoConfig {
  id: string;
  nomeNucleo: string;
  coordenadorNome: string;
  coordenadorEsposaNome: string;
  ano: number;
}

export interface DisciplinaTurma {
  id: string;
  moduloId: string;
  numero: number;
  nome: string;
  professor: string;
  honorario: number;
  horario: string;
}

export interface Modulo {
  id: string;
  turmaId: string;
  nome: string;
  ordem: number;
  disciplinas: DisciplinaTurma[];
}

export interface Turma {
  id: string;
  nome: string;
  turno: Turno;
  disciplina: string;
  professor: string;
  diasSemana: string;
  nucleo: string;
  honorario: number;
  dataAula?: string;
  horario?: string;
  createdAt: string;
  modulos?: Modulo[];
}

export interface Aluno {
  id: string;
  nome: string;
  matricula: string;
  telefone: string;
  email: string;
  turmaId: string | null;
  turma?: Turma;
  tipoBolsa: TipoBolsa;
  ativo: boolean;
  createdAt: string;
  inadimplente?: boolean;
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
  valor: number;
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
