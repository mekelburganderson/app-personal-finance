import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AuthError } from '@/data/repository';
import { DEMO_USER } from '@/data/seed';
import { useAuth } from '@/state/auth';
import { Button } from '@/ui/controls';
import { TextField } from '@/ui/fields';
import { T } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e = email, p = password) => {
    if (!e.trim() || !p) {
      setError('Informe e-mail e senha.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(e, p);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 6 }}>
        <T variant="h1">Entrar</T>
        <T color={colors.ink3}>Acesse com seu e-mail e senha.</T>
      </View>

      <View style={{ gap: 14 }}>
        <TextField
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          placeholder="voce@email.com"
        />
        <TextField
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          placeholder="••••••••"
          onSubmitEditing={() => submit()}
        />
        {error ? (
          <View style={{ backgroundColor: colors.expenseSoft, padding: 10, borderRadius: radius.sm }}>
            <T variant="small" color={colors.expense}>{error}</T>
          </View>
        ) : null}
        <Button label="Entrar" onPress={() => submit()} loading={loading} full />
      </View>

      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
        <T color={colors.ink3}>Ainda não tem conta?</T>
        <Link href="/cadastro" asChild>
          <Pressable>
            <T weight="semibold" style={{ textDecorationLine: 'underline' }}>Criar conta</T>
          </Pressable>
        </Link>
      </View>

      <Pressable
        onPress={() => {
          setEmail(DEMO_USER.email);
          setPassword(DEMO_USER.password);
          submit(DEMO_USER.email, DEMO_USER.password);
        }}
        style={({ hovered }: { hovered?: boolean }) => ({
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: hovered ? colors.ink3 : colors.lineStrong,
          borderRadius: radius.md,
          padding: 14,
          gap: 2,
        })}
      >
        <T variant="small" weight="medium">Explorar com a conta de demonstração</T>
        <T variant="caption" color={colors.ink3}>Dados fictícios de 3 meses, com cartões, parcelas e contas fixas.</T>
      </Pressable>
    </View>
  );
}
