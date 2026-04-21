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
}

export type PaymentType = 'dinheiro' | 'pixTransferencia' | 'cartaoAssinatura' | 'cartaoDebito';
