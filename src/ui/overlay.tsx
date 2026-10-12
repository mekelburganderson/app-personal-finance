import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, IconButton } from './controls';
import { T } from './Text';
import { colors, radius, shadow, useLayout } from './theme';

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 560,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const { isMedium } = useLayout();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={isMedium ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={[styles.backdrop, !isMedium && { justifyContent: 'flex-end', padding: 0 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar" />
        <View
          style={[
            styles.sheet,
            shadow,
            isMedium
              ? { width, maxWidth: '100%', maxHeight: '90%' }
              : { width: '100%', maxHeight: '94%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <T variant="h2">{title}</T>
              {subtitle ? <T variant="small" color={colors.ink3}>{subtitle}</T> : null}
            </View>
            <IconButton icon="x" label="Fechar" onPress={onClose} />
          </View>
          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? (
            <View style={[styles.footer, { paddingBottom: 14 + (isMedium ? 0 : insets.bottom) }]}>{footer}</View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Confirmação                                                         */
/* ------------------------------------------------------------------ */

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** Opções extras (ex.: escopo de exclusão em séries). */
  choices?: { value: string; label: string; hint?: string }[];
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<string | null>;

const ConfirmContext = createContext<ConfirmFn>(async () => null);
const ToastContext = createContext<(message: string, tone?: 'ok' | 'error') => void>(() => {});

export const useConfirm = () => useContext(ConfirmContext);
export const useToast = () => useContext(ToastContext);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: string | null) => void }) | null>(null);
  const [choice, setChoice] = useState<string>('confirm');
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'error'; key: number } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise((resolve) => {
        setChoice(opts.choices?.[0]?.value ?? 'confirm');
        setState({ ...opts, resolve });
      }),
    [],
  );

  const showToast = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ message, tone, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: false }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => setToast(null));
    }, 2600);
    return () => clearTimeout(t);
  }, [toast, opacity]);

  const close = (value: string | null) => {
    state?.resolve(value);
    setState(null);
  };

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      <ToastContext.Provider value={showToast}>
        {children}
        <Sheet
          visible={!!state}
          onClose={() => close(null)}
          title={state?.title ?? ''}
          width={440}
          footer={
            <>
              <Button label="Cancelar" variant="secondary" onPress={() => close(null)} />
              <Button
                label={state?.confirmLabel ?? 'Confirmar'}
                variant={state?.destructive ? 'danger' : 'primary'}
                onPress={() => close(choice)}
              />
            </>
          }
        >
          {state?.message ? <T color={colors.ink2}>{state.message}</T> : null}
          {state?.choices?.map((c) => (
            <Pressable
              key={c.value}
              onPress={() => setChoice(c.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: choice === c.value }}
              style={[styles.choice, choice === c.value && { borderColor: colors.ink, backgroundColor: colors.surfaceAlt }]}
            >
              <View style={[styles.radio, choice === c.value && { borderColor: colors.ink }]}>
                {choice === c.value && <View style={styles.radioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <T weight="medium">{c.label}</T>
                {c.hint ? <T variant="caption" color={colors.ink3}>{c.hint}</T> : null}
              </View>
            </Pressable>
          ))}
        </Sheet>
        {toast ? (
          <Animated.View pointerEvents="none" style={[styles.toastWrap, { opacity }]}>
            <View style={[styles.toast, shadow]}>
              <Icon name={toast.tone === 'ok' ? 'check-circle' : 'alert-circle'} size={16} color={toast.tone === 'ok' ? '#8FD1B0' : '#F2A08C'} />
              <T variant="small" color="#fff">{toast.message}</T>
            </View>
          </Animated.View>
        ) : null}
      </ToastContext.Provider>
    </ConfirmContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(21,23,26,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surfaceAlt,
  },
  choice: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink },
  toastWrap: { position: 'absolute', bottom: 96, left: 0, right: 0, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
});
