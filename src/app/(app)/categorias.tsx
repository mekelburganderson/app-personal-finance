import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Category, EntryKind } from '@/domain/types';
import { ColorPicker } from '@/features/CardForm';
import { InUseError, useData } from '@/state/data';
import { Button, IconButton, Segmented } from '@/ui/controls';
import { TextField } from '@/ui/fields';
import { EmptyState, Panel, Screen } from '@/ui/layout';
import { Sheet, useConfirm, useToast } from '@/ui/overlay';
import { T } from '@/ui/Text';
import { colors, swatches, useLayout } from '@/ui/theme';

type FormTarget = { category?: Category; parent?: Category; kind: EntryKind };

export default function Categorias() {
  const data = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const { isMedium } = useLayout();
  const [kind, setKind] = useState<EntryKind>('despesa');
  const [form, setForm] = useState<FormTarget | null>(null);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of data.transactions) {
      if (t.categoryId) m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1);
      if (t.subcategoryId) m.set(t.subcategoryId, (m.get(t.subcategoryId) ?? 0) + 1);
    }
    return m;
  }, [data.transactions]);

  const parents = data.categories.filter((c) => c.kind === kind && !c.parentId).sort((a, b) => a.name.localeCompare(b.name));

  const remove = async (c: Category) => {
    const subs = data.categories.filter((x) => x.parentId === c.id).length;
    const ok = await confirm({
      title: `Excluir ${c.parentId ? 'subcategoria' : 'categoria'}?`,
      message: subs ? `"${c.name}" e suas ${subs} subcategorias serão removidas.` : `"${c.name}" será removida.`,
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!ok) return;
    try {
      await data.deleteCategory(c.id);
      toast('Categoria excluída');
    } catch (err) {
      toast(err instanceof InUseError ? err.message : 'Não foi possível excluir', 'error');
    }
  };

  return (
    <Screen
      title="Categorias"
      subtitle="Organize receitas e despesas em categorias e subcategorias"
      actions={<Button label="Nova categoria" icon="plus" onPress={() => setForm({ kind })} />}
    >
      <View style={{ maxWidth: 320 }}>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'despesa', label: 'Despesas' },
            { value: 'receita', label: 'Receitas' },
          ]}
          tones={{ despesa: colors.expense, receita: colors.income }}
        />
      </View>

      {parents.length === 0 ? (
        <Panel>
          <EmptyState icon="tag" title="Nenhuma categoria" action={<Button label="Criar categoria" onPress={() => setForm({ kind })} />} />
        </Panel>
      ) : (
        <View style={styles.grid}>
          {parents.map((p) => {
            const subs = data.categories.filter((c) => c.parentId === p.id).sort((a, b) => a.name.localeCompare(b.name));
            return (
              <View key={p.id} style={[styles.card, { flexBasis: isMedium ? 300 : '100%' }]}>
                <View style={styles.head}>
                  <View style={[styles.swatch, { backgroundColor: p.color }]} />
                  <View style={{ flex: 1 }}>
                    <T weight="semibold">{p.name}</T>
                    <T variant="caption" color={colors.ink3}>{usage.get(p.id) ?? 0} lançamento(s)</T>
                  </View>
                  <IconButton icon="edit-2" label={`Editar ${p.name}`} onPress={() => setForm({ category: p, kind })} />
                  <IconButton icon="trash-2" label={`Excluir ${p.name}`} onPress={() => remove(p)} />
                </View>
                <View>
                  {subs.map((s) => (
                    <View key={s.id} style={styles.sub}>
                      <T variant="small" style={{ flex: 1 }}>{s.name}</T>
                      <T variant="caption" color={colors.ink3} tabular>{usage.get(s.id) ?? 0}</T>
                      <IconButton icon="edit-2" size={30} label={`Editar ${s.name}`} onPress={() => setForm({ category: s, parent: p, kind })} />
                      <IconButton icon="x" size={30} label={`Excluir ${s.name}`} onPress={() => remove(s)} />
                    </View>
                  ))}
                </View>
                <Button size="sm" variant="ghost" icon="plus" label="Subcategoria" onPress={() => setForm({ parent: p, kind })} style={{ alignSelf: 'flex-start' }} />
              </View>
            );
          })}
        </View>
      )}

      <CategoryForm target={form} onClose={() => setForm(null)} />
    </Screen>
  );
}

function CategoryForm({ target, onClose }: { target: FormTarget | null; onClose: () => void }) {
  const data = useData();
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState(swatches[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setName(target.category?.name ?? '');
    setColor(target.category?.color ?? target.parent?.color ?? swatches[0]);
    setError(null);
  }, [target]);

  if (!target) return null;
  const isSub = !!target.parent;

  const save = async () => {
    const n = name.trim();
    if (!n) return setError('Informe o nome.');
    const siblings = data.categories.filter(
      (c) => c.kind === target.kind && c.parentId === (target.parent?.id ?? null) && c.id !== target.category?.id,
    );
    if (siblings.some((c) => c.name.toLowerCase() === n.toLowerCase())) return setError('Já existe com este nome.');
    await data.saveCategory({
      id: target.category?.id,
      name: n,
      kind: target.kind,
      parentId: target.parent?.id ?? null,
      color: isSub ? target.parent!.color : color,
    });
    // Subcategorias herdam a cor da categoria.
    if (!isSub && target.category) {
      for (const s of data.categories.filter((c) => c.parentId === target.category!.id && c.color !== color)) {
        await data.saveCategory({ ...s, color });
      }
    }
    toast('Categoria salva');
    onClose();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={`${target.category ? 'Editar' : 'Nova'} ${isSub ? 'subcategoria' : 'categoria'}`}
      subtitle={isSub ? `Em ${target.parent!.name}` : target.kind === 'receita' ? 'Receita' : 'Despesa'}
      width={460}
      footer={
        <>
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
          <Button label="Salvar" onPress={save} />
        </>
      }
    >
      <TextField label="Nome" value={name} onChangeText={setName} error={error} autoFocus onSubmitEditing={save} />
      {!isSub ? <ColorPicker value={color} onChange={setColor} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' },
  card: {
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 12, height: 32, borderRadius: 3 },
  sub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 22,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    minHeight: 38,
  },
});
