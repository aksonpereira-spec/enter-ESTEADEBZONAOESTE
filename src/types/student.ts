export interface Student {
  id: number;
  matricula: string;
  nome: string;
  dinheiro: number;
  pixTransferencia: number;
  cartaoAssinatura: number;
  cartaoDebito: number;
  situacao: 'Pago' | 'Pendente' | '-';
  apostilas: 'Sim' | 'Não';
  obs: string;
  mes: string; // formato: "YYYY-MM"
}

export interface Coordinator {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  nucleo: string;
  dataInicio: string;
}

export interface Discipline {
  id: number;
  nome: string;
  professor: string;
  cargaHoraria: number;
  diasSemana: string;
  horario: string;
}

export type PaymentType = 'dinheiro' | 'pixTransferencia' | 'cartaoAssinatura' | 'cartaoDebito';

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

export const TAXA_CARTAO_ASSINATURA = 0.04; // 4%
export const TAXA_CARTAO_DEBITO = 0.017; // 1.7%
export const TAXA_COMISSAO = 0.12; // 12%
