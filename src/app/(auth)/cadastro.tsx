import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AuthError } from '@/data/repository';
import { useAuth } from '@/state/auth';
import { Button } from '@/ui/controls';
import { TextField } from '@/ui/fields';
import { T } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Cadastro() {
  const { signUp } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const e: typeof errors = {};
    if (form.name.trim().length < 2) e.name = 'Informe seu nome.';
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'E-mail inválido.';
    if (form.password.length < 8) e.password = 'Use pelo menos 8 caracteres.';
    if (form.confirm !== form.password) e.confirm = 'As senhas não conferem.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    setError(null);
    try {
      await signUp(form.name, form.email, form.password);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 6 }}>
        <T variant="h1">Criar conta</T>
        <T color={colors.ink3}>Cada conta tem seus próprios lançamentos — ninguém mais os vê.</T>
      </View>

      <View style={{ gap: 14 }}>
        <TextField label="Nome" value={form.name} onChangeText={set('name')} error={errors.name} autoComplete="name" />
        <TextField
          label="E-mail"
          value={form.email}
          onChangeText={set('email')}
          error={errors.email}
          autoCapitalize="none"
          keyboardType="email-address"
          inputMode="email"
          autoComplete="email"
        />
        <TextField
          label="Senha"
          value={form.password}
          onChangeText={set('password')}
          error={errors.password}
          hint="Mínimo de 8 caracteres."
          secureTextEntry
          autoComplete="new-password"
        />
        <TextField
          label="Confirmar senha"
          value={form.confirm}
          onChangeText={set('confirm')}
          error={errors.confirm}
          secureTextEntry
          autoComplete="new-password"
          onSubmitEditing={submit}
        />
        {error ? (
          <View style={{ backgroundColor: colors.expenseSoft, padding: 10, borderRadius: radius.sm }}>
            <T variant="small" color={colors.expense}>{error}</T>
          </View>
        ) : null}
        <Button label="Criar conta" onPress={submit} loading={loading} full />
      </View>

      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
        <T color={colors.ink3}>Já tem conta?</T>
        <Link href="/login" asChild>
          <Pressable>
            <T weight="semibold" style={{ textDecorationLine: 'underline' }}>Entrar</T>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
