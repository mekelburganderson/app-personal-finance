import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { User } from '@/domain/types';
import { nowISO, uid } from './ids';
import { AuthError, type Collection, type Dataset, type PublicUser, type Repository } from './repository';
import { defaultCategories, demoDataset, DEMO_USER } from './seed';

const KEY_USERS = 'pf:v1:users';
const KEY_SESSION = 'pf:v1:session';
const keyData = (userId: string) => `pf:v1:data:${userId}`;

const emptyDataset = (): Dataset => ({
  accounts: [],
  categories: [],
  cards: [],
  transactions: [],
  invoicePayments: [],
});

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function hashPassword(email: string, password: string) {
  // Protótipo: hash com "sal" derivado do e-mail. No Supabase a senha nunca passa pelo app.
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `pf:${normalizeEmail(email)}:${password}`);
}

const toPublic = ({ passwordHash: _omit, ...user }: User): PublicUser => user;

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const writeJSON = (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));

/** Simula latência de rede para o protótipo se comportar como o backend real. */
const latency = () => new Promise((r) => setTimeout(r, 120));

export class LocalRepository implements Repository {
  private async users(): Promise<User[]> {
    const users = await readJSON<User[]>(KEY_USERS, []);
    if (!users.some((u) => u.email === DEMO_USER.email)) {
      const demo: User = {
        id: DEMO_USER.id,
        name: DEMO_USER.name,
        email: DEMO_USER.email,
        passwordHash: await hashPassword(DEMO_USER.email, DEMO_USER.password),
        createdAt: nowISO(),
      };
      users.push(demo);
      await writeJSON(KEY_USERS, users);
      await writeJSON(keyData(demo.id), demoDataset(demo.id));
    }
    return users;
  }

  async getSession() {
    const userId = await AsyncStorage.getItem(KEY_SESSION);
    if (!userId) return null;
    const user = (await this.users()).find((u) => u.id === userId);
    return user ? toPublic(user) : null;
  }

  async signUp(input: { name: string; email: string; password: string }) {
    await latency();
    const email = normalizeEmail(input.email);
    const users = await this.users();
    if (users.some((u) => u.email === email)) {
      throw new AuthError('Já existe uma conta com este e-mail.');
    }
    const user: User = {
      id: uid(),
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(email, input.password),
      createdAt: nowISO(),
    };
    await writeJSON(KEY_USERS, [...users, user]);
    await writeJSON(keyData(user.id), { ...emptyDataset(), categories: defaultCategories(user.id) });
    await AsyncStorage.setItem(KEY_SESSION, user.id);
    return toPublic(user);
  }

  async signIn(input: { email: string; password: string }) {
    await latency();
    const email = normalizeEmail(input.email);
    const user = (await this.users()).find((u) => u.email === email);
    const hash = await hashPassword(email, input.password);
    if (!user || user.passwordHash !== hash) {
      throw new AuthError('E-mail ou senha incorretos.');
    }
    await AsyncStorage.setItem(KEY_SESSION, user.id);
    return toPublic(user);
  }

  async signOut() {
    await AsyncStorage.removeItem(KEY_SESSION);
  }

  async load(userId: string): Promise<Dataset> {
    await this.assertSession(userId);
    const data = await readJSON<Dataset>(keyData(userId), emptyDataset());
    // Defesa em profundidade: descarta qualquer registro que não seja do usuário.
    return {
      accounts: data.accounts.filter((x) => x.userId === userId),
      categories: data.categories.filter((x) => x.userId === userId),
      cards: data.cards.filter((x) => x.userId === userId),
      transactions: data.transactions.filter((x) => x.userId === userId),
      invoicePayments: data.invoicePayments.filter((x) => x.userId === userId),
    };
  }

  async upsert<C extends Collection>(userId: string, collection: C, items: Dataset[C]) {
    await this.assertSession(userId);
    if ((items as { userId: string }[]).some((i) => i.userId !== userId)) {
      throw new AuthError('Operação não permitida para este usuário.');
    }
    const data = await this.load(userId);
    const list = data[collection] as { id: string }[];
    for (const item of items as { id: string }[]) {
      const idx = list.findIndex((x) => x.id === item.id);
      if (idx >= 0) list[idx] = item;
      else list.push(item);
    }
    await writeJSON(keyData(userId), data);
  }

  async remove(userId: string, collection: Collection, ids: string[]) {
    await this.assertSession(userId);
    const data = await this.load(userId);
    const set = new Set(ids);
    data[collection] = (data[collection] as { id: string }[]).filter((x) => !set.has(x.id)) as never;
    await writeJSON(keyData(userId), data);
  }

  private async assertSession(userId: string) {
    const session = await AsyncStorage.getItem(KEY_SESSION);
    if (session !== userId) throw new AuthError('Sessão expirada. Entre novamente.');
  }
}

export const repository: Repository = new LocalRepository();
