export const TAXA_CARTAO_ASSINATURA = 0.04;
export const TAXA_CARTAO_DEBITO = 0.017;
export const TAXA_COMISSAO = 0.12;

export interface Student {
  id: string;
  numero: number;
  matricula: string;
  nome: string;
  dinheiro: number;
  pixTransferencia: number;
  cartaoAssinatura: number;
  cartaoDebito: number;
  situacao: 'Pago' | 'Pendente' | '-';
  apostilas: 'Sim' | 'Não';
  obs: string;
  mes: string;
}

export interface Coordinator {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  nucleo: string;
  dataInicio: string;
}

export interface Discipline {
  id: string;
  nome: string;
  professor: string;
  cargaHoraria: number;
  diasSemana: string;
  horario: string;
}

export interface FinancialSummary {
  totalDinheiro: number;
  totalPix: number;
  totalCartaoAssinatura: number;
  totalCartaoAssinaturaLiquido: number;
  totalCartaoDebito: number;
  totalCartaoDebitoLiquido: number;
  totalGeral: number;
  totalGeralLiquido: number;
  comissao: number;
  qtdAlunos: number;
  qtdApostilas: number;
}
