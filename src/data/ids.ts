import * as Crypto from 'expo-crypto';

export function uid(): string {
  return Crypto.randomUUID();
}

export function nowISO(): string {
  return new Date().toISOString();
}
