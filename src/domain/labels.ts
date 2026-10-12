import type { AccountType, InvoiceStatus, PaymentMethod } from './types';

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  boleto: 'Boleto',
  debito: 'Cartão de débito',
  transferencia: 'Transferência',
  debito_automatico: 'Débito automático',
  cartao_credito: 'Cartão de crédito',
};

export const PAYMENT_ICON: Record<PaymentMethod, string> = {
  pix: 'zap',
  dinheiro: 'dollar-sign',
  boleto: 'file-text',
  debito: 'credit-card',
  transferencia: 'repeat',
  debito_automatico: 'refresh-cw',
  cartao_credito: 'credit-card',
};

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  carteira: 'Dinheiro em espécie',
  investimento: 'Investimentos',
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  aberta: 'Aberta',
  fechada: 'Fechada',
  paga: 'Paga',
  futura: 'Futura',
};
