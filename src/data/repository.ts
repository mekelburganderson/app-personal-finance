import type {
  Account,
  Category,
  CreditCard,
  InvoicePayment,
  Transaction,
  User,
} from '@/domain/types';

export type PublicUser = Omit<User, 'passwordHash'>;

export interface Dataset {
  accounts: Account[];
  categories: Category[];
  cards: CreditCard[];
  transactions: Transaction[];
  invoicePayments: InvoicePayment[];
}

export type Collection = keyof Dataset;

export class AuthError extends Error {}

/**
 * Contrato de acesso a dados. A implementação atual (`LocalRepository`) grava no
 * armazenamento do navegador; a futura `SupabaseRepository` implementará a mesma
 * interface usando supabase-js (auth + tabelas com RLS por `user_id`).
 *
 * Toda operação de dados recebe o `userId` da sessão e só enxerga registros dele.
 */
export interface Repository {
  getSession(): Promise<PublicUser | null>;
  signUp(input: { name: string; email: string; password: string }): Promise<PublicUser>;
  signIn(input: { email: string; password: string }): Promise<PublicUser>;
  signOut(): Promise<void>;

  load(userId: string): Promise<Dataset>;
  upsert<C extends Collection>(userId: string, collection: C, items: Dataset[C]): Promise<void>;
  remove(userId: string, collection: Collection, ids: string[]): Promise<void>;
}
